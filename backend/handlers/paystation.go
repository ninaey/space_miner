package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"slices"
	"strings"
)

// ── PayStation token creation (Xsolla v3 Admin Token API) ────────

type createPaymentRequest struct {
	SKU string `json:"sku"`
}

type v3TokenRequest struct {
	User             v3User            `json:"user"`
	Settings         *v3Settings       `json:"settings,omitempty"`
	Purchase         v3Purchase        `json:"purchase"`
	Sandbox          bool              `json:"sandbox"`
	CustomParameters map[string]string `json:"custom_parameters,omitempty"`
}

type v3User struct {
	ID      v3Field    `json:"id"`
	Name    *v3Field   `json:"name,omitempty"`
	Email   *v3Field   `json:"email,omitempty"`
	Country *v3Country `json:"country,omitempty"`
}

type v3Field struct {
	Value string `json:"value"`
}

type v3Country struct {
	Value       string `json:"value"`
	AllowModify bool   `json:"allow_modify,omitempty"`
}

type v3Settings struct {
	Language string `json:"language,omitempty"`
	Currency string `json:"currency,omitempty"`
}

type v3Purchase struct {
	Items []v3PurchaseItem `json:"items"`
}

type v3PurchaseItem struct {
	SKU      string `json:"sku"`
	Quantity int    `json:"quantity"`
}

type v3TokenResponse struct {
	Token   string `json:"token"`
	OrderID int64  `json:"order_id"`
}

// xsollaErrorResponse handles two error shapes returned by Xsolla APIs:
//   - Store v3:     {"errorMessage": "...", "statusCode": 422}
//   - PayStation:   {"error": {"code": "...", "description": "..."}}
type xsollaErrorResponse struct {
	ErrorMessage string `json:"errorMessage"`
	Error        *struct {
		Code        string `json:"code"`
		Description string `json:"description"`
	} `json:"error"`
}

// CreatePayment godoc
// @Summary      Create a PayStation payment token
// @Description  Calls the Xsolla v3 Admin Token API to obtain a PayStation URL token for the given SKU. The returned token can be used to open the Xsolla payment widget.
// @Tags         store
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      createPaymentRequest  true  "SKU to purchase"
// @Success      200   {object}  map[string]any        "token and order_id"
// @Failure      400   {object}  APIError
// @Failure      401   {object}  APIError
// @Failure      502   {object}  APIError
// @Router       /api/store/create-payment [post]
func (h *StoreHandler) CreatePayment(w http.ResponseWriter, r *http.Request) {
	playerID, ok := PlayerIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing authenticated player")
		return
	}

	// POST /v3/project/{project_id}/admin/payment/token uses Catalog API basicAuth:
	// Authorization: Basic base64(project_id:api_key). See Xsolla docs (not merchant_id:api_key).
	var missing []string
	if h.apiKey == "" {
		missing = append(missing, "XSOLLA_API_KEY")
	}
	if h.projectID == 0 {
		missing = append(missing, "XSOLLA_PROJECT_ID")
	}
	if len(missing) > 0 {
		slices.Sort(missing)
		writeError(w, http.StatusServiceUnavailable, fmt.Sprintf("PayStation not configured: missing %s", strings.Join(missing, ", ")))
		return
	}

	var req createPaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.SKU == "" {
		writeError(w, http.StatusBadRequest, "sku is required")
		return
	}

	player, err := h.service.GetPlayerByID(r.Context(), playerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load player")
		return
	}

	lang := h.payStationLanguage
	if lang == "" {
		lang = "en"
	}
	settings := &v3Settings{Language: lang}
	if h.payStationCurrency != "" {
		settings.Currency = h.payStationCurrency
	}

	user := v3User{ID: v3Field{Value: playerID}}
	if strings.TrimSpace(player.Username) != "" {
		user.Name = &v3Field{Value: strings.TrimSpace(player.Username)}
	}
	if strings.TrimSpace(player.Email) != "" {
		user.Email = &v3Field{Value: strings.TrimSpace(player.Email)}
	}

	// Xsolla requires user.country OR a geolocatable public IP in X-User-Ip.
	// Localhost / Docker bridge IPs are not valid for IP-based country detection;
	// sending them breaks PayStation with generic 422 / [0401-2000].
	country := h.payStationCountry
	if country == "" && xsollaPublicClientIP(r) == "" {
		country = "US"
	}
	if country != "" {
		user.Country = &v3Country{Value: country, AllowModify: true}
	}

	tokenReq := v3TokenRequest{
		User:     user,
		Settings: settings,
		Purchase: v3Purchase{
			Items: []v3PurchaseItem{
				{SKU: req.SKU, Quantity: 1},
			},
		},
		Sandbox: h.payStationSandbox,
		CustomParameters: map[string]string{
			"sku": req.SKU,
		},
	}

	body, err := json.Marshal(tokenReq)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to build token request")
		return
	}

	url := fmt.Sprintf("https://store.xsolla.com/api/v3/project/%d/admin/payment/token", h.projectID)
	httpReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create HTTP request")
		return
	}

	credentials := fmt.Sprintf("%d:%s", h.projectID, h.apiKey)
	httpReq.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(credentials)))
	httpReq.Header.Set("Content-Type", "application/json")

	if ip := xsollaPublicClientIP(r); ip != "" {
		httpReq.Header.Set("X-User-Ip", ip)
	}

	resp, err := h.httpClient.Do(httpReq)
	if err != nil {
		log.Printf("paystation: token request failed: %v", err)
		writeError(w, http.StatusBadGateway, "failed to contact Xsolla")
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		log.Printf("paystation: xsolla returned %d: %s", resp.StatusCode, string(respBody))
		details := fmt.Sprintf("Xsolla token creation failed (status %d)", resp.StatusCode)
		var xsErr xsollaErrorResponse
		if err := json.Unmarshal(respBody, &xsErr); err == nil {
			switch {
			case xsErr.ErrorMessage != "":
				details = fmt.Sprintf("%s: %s", details, xsErr.ErrorMessage)
			case xsErr.Error != nil && xsErr.Error.Description != "":
				details = fmt.Sprintf("%s: [%s] %s", details, xsErr.Error.Code, xsErr.Error.Description)
			}
		}
		// [0401-2000] is a generic PayStation failure: module off, wrong sandbox mode,
		// API key scopes, or project/merchant mismatch. See .env.example (XSOLLA_PAYSTATION_*).
		if resp.StatusCode == http.StatusUnprocessableEntity {
			log.Printf("paystation: 422 hint — PayStation enabled + API key (Store+PayStation); XSOLLA_PAYSTATION_SANDBOX matches project; set XSOLLA_PAYSTATION_COUNTRY for local/Docker (never send private/loopback IP as X-User-Ip)")
		}
		writeError(w, http.StatusBadGateway, details)
		return
	}

	var tokenResp v3TokenResponse
	if err := json.Unmarshal(respBody, &tokenResp); err != nil {
		log.Printf("paystation: failed to decode token response: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to parse Xsolla response")
		return
	}

	log.Printf("paystation: created token for player=%s sku=%s order=%d", playerID, req.SKU, tokenResp.OrderID)

	writeJSON(w, http.StatusOK, map[string]any{
		"token":    tokenResp.Token,
		"order_id": tokenResp.OrderID,
		"sandbox":  h.payStationSandbox,
	})
}

// clientIP extracts the best-guess client IP from proxy headers or RemoteAddr.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if idx := strings.Index(xff, ","); idx >= 0 {
			return strings.TrimSpace(xff[:idx])
		}
		return strings.TrimSpace(xff)
	}
	if xrip := r.Header.Get("X-Real-Ip"); xrip != "" {
		return strings.TrimSpace(xrip)
	}
	host := r.RemoteAddr
	if idx := strings.LastIndex(host, ":"); idx >= 0 {
		host = host[:idx]
	}
	return strings.Trim(host, "[]")
}

// xsollaPublicClientIP returns an IP suitable for X-User-Ip: only routable
// public addresses. Private/loopback IPs must not be sent; use user.country instead.
func xsollaPublicClientIP(r *http.Request) string {
	ip := clientIP(r)
	if ip == "" {
		return ""
	}
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return ""
	}
	if parsed.IsLoopback() || parsed.IsPrivate() || parsed.IsLinkLocalUnicast() {
		return ""
	}
	return ip
}

// ── Webhook notification types and parsing ───────────────────────

type webhookNotification struct {
	NotificationType string              `json:"notification_type"`
	User             *webhookUser        `json:"user,omitempty"`
	Transaction      *webhookTransaction `json:"transaction,omitempty"`
	Purchase         *webhookPurchase    `json:"purchase,omitempty"`
}

type webhookUser struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type webhookTransaction struct {
	ID            int64   `json:"id"`
	ExternalID    string  `json:"external_id"`
	DryRun        int     `json:"dry_run"`
	PaymentDate   string  `json:"payment_date"`
	PaymentMethod int     `json:"payment_method"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
}

type webhookPurchase struct {
	VirtualCurrency *webhookVCPurchase   `json:"virtual_currency,omitempty"`
	VirtualItems    *webhookVirtualItems `json:"virtual_items,omitempty"`
	Total           *webhookTotal        `json:"total,omitempty"`
}

type webhookVCPurchase struct {
	Name     string  `json:"name"`
	SKU      string  `json:"sku"`
	Quantity float64 `json:"quantity"`
	Currency string  `json:"currency"`
	Amount   float64 `json:"amount"`
}

type webhookVirtualItems struct {
	Items []webhookVItem `json:"items"`
}

type webhookVItem struct {
	SKU      string `json:"sku"`
	Quantity int    `json:"quantity"`
}

type webhookTotal struct {
	Amount   float64 `json:"amount"`
	Currency string  `json:"currency"`
}
