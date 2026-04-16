package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

// localizedField handles Xsolla's inconsistent JSON: sometimes a localized
// map like {"en": "Sword"}, sometimes a plain string like "Sword".
type localizedField map[string]string

func (lf *localizedField) UnmarshalJSON(data []byte) error {
	// Try map first
	var m map[string]string
	if err := json.Unmarshal(data, &m); err == nil {
		*lf = m
		return nil
	}
	// Fall back to plain string
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		*lf = map[string]string{"en": s}
		return nil
	}
	*lf = map[string]string{}
	return nil
}

// CatalogItem is the unified shape returned to the frontend.
// It merges data from Xsolla virtual items and VC packages
// with game-specific metadata from the local database.
type CatalogItem struct {
	SKU         string  `json:"sku"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	ImageURL    string  `json:"image_url,omitempty"`
	Category    string  `json:"category"`
	Currency    string  `json:"currency"`    // "real" or "gem"
	Price       float64 `json:"price"`       // USD cents for real, gem count for gem
	PriceStr    string  `json:"price_str"`   // display string from Xsolla (e.g. "$4.99")
	GemsGranted int     `json:"gems_granted"`
	Featured    bool    `json:"featured"`
	OneTime     bool    `json:"one_time"`

	EffectType     string  `json:"effect_type,omitempty"`
	EffectValue    float64 `json:"effect_value,omitempty"`
	EffectDuration int     `json:"effect_duration,omitempty"`
}

// xsollaVirtualItemsResponse matches Xsolla GET /v2/project/{id}/items/virtual_items
type xsollaVirtualItemsResponse struct {
	HasMore bool                 `json:"has_more"`
	Items   []xsollaVirtualItem  `json:"items"`
}

type xsollaVirtualItem struct {
	SKU         string                 `json:"sku"`
	Name        localizedField         `json:"name"`
	Description localizedField         `json:"description"`
	ImageURL    string                 `json:"image_url"`
	IsFree      bool                   `json:"is_free"`
	Groups      []xsollaGroup          `json:"groups"`
	Price       *xsollaPrice           `json:"price"`
	VCPrices    []xsollaVCPrice        `json:"virtual_prices"`
	Attributes  []xsollaAttribute      `json:"attributes"`
}

type xsollaGroup struct {
	ExternalID string `json:"external_id"`
	Name       string `json:"name"`
}

type xsollaPrice struct {
	Amount         string `json:"amount"`
	AmountInCents  string `json:"amount_in_cents"`
	Currency       string `json:"currency"`
}

type xsollaVCPrice struct {
	SKU            string `json:"sku"`
	Name           string `json:"name"`
	Amount         int    `json:"amount"`
	AmountWithout  int    `json:"amount_without_discount"`
	ImageURL       string `json:"image_url"`
	IsDefault      bool   `json:"is_default"`
}

type xsollaAttribute struct {
	ExternalID string            `json:"external_id"`
	Name       string            `json:"name"`
	Values     []xsollaAttrValue `json:"values"`
}

type xsollaAttrValue struct {
	ExternalID string `json:"external_id"`
	Value      string `json:"value"`
}

// xsollaVCPackagesResponse matches Xsolla GET /v2/project/{id}/items/virtual_currency/package
type xsollaVCPackagesResponse struct {
	HasMore bool              `json:"has_more"`
	Items   []xsollaVCPkg     `json:"items"`
}

type xsollaVCPkg struct {
	SKU         string         `json:"sku"`
	Name        localizedField `json:"name"`
	Description localizedField `json:"description"`
	ImageURL    string         `json:"image_url"`
	Price       *xsollaPrice   `json:"price"`
	Content     []xsollaVCContent `json:"content"`
	IsFree      bool           `json:"is_free"`
}

type xsollaVCContent struct {
	SKU      string `json:"sku"`
	Name     string `json:"name"`
	Quantity int    `json:"quantity"`
}

// catalogCache stores the last successful Xsolla fetch to reduce API calls.
type catalogCache struct {
	mu        sync.RWMutex
	items     []CatalogItem
	fetchedAt time.Time
	ttl       time.Duration
}

func newCatalogCache(ttl time.Duration) *catalogCache {
	return &catalogCache{ttl: ttl}
}

func (c *catalogCache) get() ([]CatalogItem, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.items == nil || time.Since(c.fetchedAt) > c.ttl {
		return nil, false
	}
	return c.items, true
}

func (c *catalogCache) set(items []CatalogItem) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items = items
	c.fetchedAt = time.Now()
}

// XsollaCatalogFetcher handles retrieving and transforming the Xsolla catalog.
type XsollaCatalogFetcher struct {
	projectID  int
	baseURL    string
	httpClient *http.Client
	cache      *catalogCache
}

func NewXsollaCatalogFetcher(projectID int) *XsollaCatalogFetcher {
	if projectID == 0 {
		return nil
	}
	return &XsollaCatalogFetcher{
		projectID: projectID,
		baseURL:   "https://store.xsolla.com/api",
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		cache: newCatalogCache(5 * time.Minute),
	}
}

// FetchCatalog retrieves virtual items + VC packages from Xsolla and merges them.
func (f *XsollaCatalogFetcher) FetchCatalog(ctx context.Context) ([]CatalogItem, error) {
	if cached, ok := f.cache.get(); ok {
		return cached, nil
	}

	type result struct {
		items []CatalogItem
		err   error
	}

	viCh := make(chan result, 1)
	vcCh := make(chan result, 1)

	go func() {
		items, err := f.fetchVirtualItems(ctx)
		viCh <- result{items, err}
	}()
	go func() {
		items, err := f.fetchVCPackages(ctx)
		vcCh <- result{items, err}
	}()

	viResult := <-viCh
	vcResult := <-vcCh

	var catalog []CatalogItem

	if viResult.err != nil {
		log.Printf("xsolla: failed to fetch virtual items: %v", viResult.err)
	} else {
		catalog = append(catalog, viResult.items...)
	}

	if vcResult.err != nil {
		log.Printf("xsolla: failed to fetch VC packages: %v", vcResult.err)
	} else {
		catalog = append(catalog, vcResult.items...)
	}

	if len(catalog) > 0 {
		f.cache.set(catalog)
	}

	return catalog, nil
}

func (f *XsollaCatalogFetcher) fetchVirtualItems(ctx context.Context) ([]CatalogItem, error) {
	url := fmt.Sprintf("%s/v2/project/%d/items/virtual_items?limit=50&locale=en", f.baseURL, f.projectID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := f.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("xsolla virtual items API returned %d", resp.StatusCode)
	}

	var body xsollaVirtualItemsResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("decode virtual items: %w", err)
	}

	items := make([]CatalogItem, 0, len(body.Items))
	for _, vi := range body.Items {
		item := CatalogItem{
			SKU:         vi.SKU,
			Name:        localizedString(vi.Name, "en"),
			Description: localizedString(vi.Description, "en"),
			ImageURL:    vi.ImageURL,
		}

		item.Category = categorizeItem(vi)
		item.Featured = isFeatured(vi)
		item.OneTime = isOneTimePurchase(vi)
		item.EffectType, item.EffectValue, item.EffectDuration = extractEffects(vi)

		if len(vi.VCPrices) > 0 {
			item.Currency = "gem"
			item.Price = float64(vi.VCPrices[0].Amount)
			item.PriceStr = fmt.Sprintf("%d Gems", vi.VCPrices[0].Amount)
		} else if vi.Price != nil {
			item.Currency = "real"
			item.PriceStr = fmt.Sprintf("%s %s", vi.Price.Amount, vi.Price.Currency)
			var price float64
			fmt.Sscanf(vi.Price.Amount, "%f", &price)
			item.Price = price
		}

		items = append(items, item)
	}

	return items, nil
}

func (f *XsollaCatalogFetcher) fetchVCPackages(ctx context.Context) ([]CatalogItem, error) {
	url := fmt.Sprintf("%s/v2/project/%d/items/virtual_currency/package?limit=50&locale=en", f.baseURL, f.projectID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := f.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("xsolla VC packages API returned %d", resp.StatusCode)
	}

	var body xsollaVCPackagesResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("decode VC packages: %w", err)
	}

	items := make([]CatalogItem, 0, len(body.Items))
	for _, pkg := range body.Items {
		gemsGranted := 0
		for _, c := range pkg.Content {
			gemsGranted += c.Quantity
		}

		item := CatalogItem{
			SKU:         pkg.SKU,
			Name:        localizedString(pkg.Name, "en"),
			Description: localizedString(pkg.Description, "en"),
			ImageURL:    pkg.ImageURL,
			Category:    "gems",
			Currency:    "real",
			GemsGranted: gemsGranted,
		}

		if pkg.Price != nil {
			item.PriceStr = fmt.Sprintf("%s %s", pkg.Price.Amount, pkg.Price.Currency)
			fmt.Sscanf(pkg.Price.Amount, "%f", &item.Price)
		}

		items = append(items, item)
	}

	return items, nil
}

func localizedString(m map[string]string, locale string) string {
	if v, ok := m[locale]; ok {
		return v
	}
	for _, v := range m {
		return v
	}
	return ""
}

// categorizeItem maps Xsolla groups to our internal categories.
func categorizeItem(vi xsollaVirtualItem) string {
	for _, g := range vi.Groups {
		switch g.ExternalID {
		case "drill", "equipment":
			return "equipment"
		case "booster", "boost":
			return "boost"
		case "cosmetic":
			return "cosmetic"
		case "gems":
			return "gems"
		case "storage":
			return "equipment"
		}
	}
	if len(vi.VCPrices) > 0 {
		return "boost"
	}
	return "equipment"
}

func isFeatured(vi xsollaVirtualItem) bool {
	for _, g := range vi.Groups {
		if g.ExternalID == "featured" {
			return true
		}
	}
	return false
}

func isOneTimePurchase(vi xsollaVirtualItem) bool {
	for _, g := range vi.Groups {
		if g.ExternalID == "one_time" || g.ExternalID == "cosmetic" {
			return true
		}
	}
	return false
}

// extractEffects reads game-specific attributes from Xsolla custom attributes.
func extractEffects(vi xsollaVirtualItem) (effectType string, effectValue float64, effectDuration int) {
	for _, attr := range vi.Attributes {
		switch attr.ExternalID {
		case "effect_type":
			if len(attr.Values) > 0 {
				effectType = attr.Values[0].ExternalID
			}
		case "effect_value":
			if len(attr.Values) > 0 {
				fmt.Sscanf(attr.Values[0].Value, "%f", &effectValue)
			}
		case "effect_duration":
			if len(attr.Values) > 0 {
				fmt.Sscanf(attr.Values[0].Value, "%d", &effectDuration)
			}
		}
	}
	return
}
