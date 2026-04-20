package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"spacecolonyminer/backend/internal/game"
	"spacecolonyminer/backend/models"
)

type AuthHandler struct {
	service *game.Service
}

type GameHandler struct {
	service *game.Service
}

type StoreHandler struct {
	service        *game.Service
	catalogURL     string
	webhookSecret  string
	projectID      int
	merchantID     int
	apiKey         string
	httpClient     *http.Client
	catalogFetcher *XsollaCatalogFetcher
}

func NewAuthHandler(service *game.Service) *AuthHandler {
	return &AuthHandler{service: service}
}

func NewGameHandler(service *game.Service) *GameHandler {
	return &GameHandler{service: service}
}

func NewStoreHandler(service *game.Service, catalogURL, webhookSecret string, projectID, merchantID int, apiKey string) *StoreHandler {
	return &StoreHandler{
		service:        service,
		catalogURL:     catalogURL,
		webhookSecret:  webhookSecret,
		projectID:      projectID,
		merchantID:     merchantID,
		apiKey:         apiKey,
		catalogFetcher: NewXsollaCatalogFetcher(projectID),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// Login godoc
// @Summary      Login or register a player
// @Description  Creates a new player account or logs in an existing one. Returns full game state and applies offline earnings.
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body      authRequest  true  "Auth credentials"
// @Success      200   {object}  map[string]any  "player_id and full game state"
// @Failure      400   {object}  APIError
// @Failure      500   {object}  APIError
// @Router       /api/auth/login [post]
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	h.upsertPlayer(w, r)
}

// Register godoc
// @Summary      Register a new player
// @Description  Alias for Login — upserts the player record and returns their full game state.
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body      authRequest  true  "Registration details"
// @Success      200   {object}  map[string]any  "player_id and full game state"
// @Failure      400   {object}  APIError
// @Failure      500   {object}  APIError
// @Router       /api/auth/register [post]
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	h.upsertPlayer(w, r)
}

func (h *AuthHandler) upsertPlayer(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if err := validateAuthRequest(req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.service.LoginOrRegister(r.Context(), req.UserID, req.Username, req.Email); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if _, err := h.service.ApplyOfflineEarnings(r.Context(), req.UserID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	state, err := h.service.GetFullState(r.Context(), req.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"player_id": req.UserID,
		"state":     state,
	})
}

// GetState godoc
// @Summary      Get player game state
// @Description  Returns the full game state for the authenticated player, including offline earnings applied since last sync.
// @Tags         game
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]any  "offline_depth_gain and full state"
// @Failure      401  {object}  APIError
// @Failure      500  {object}  APIError
// @Router       /api/game/state [get]
func (h *GameHandler) GetState(w http.ResponseWriter, r *http.Request) {
	playerID, ok := PlayerIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing authenticated player")
		return
	}

	offlineGain, err := h.service.ApplyOfflineEarnings(r.Context(), playerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	state, err := h.service.GetFullState(r.Context(), playerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"offline_depth_gain": offlineGain,
		"state":              state,
	})
}

// GetItems godoc
// @Summary      Get player inventory
// @Description  Returns all inventory items owned by the authenticated player.
// @Tags         game
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]any  "list of inventory items"
// @Failure      401  {object}  APIError
// @Failure      500  {object}  APIError
// @Router       /api/game/items [get]
func (h *GameHandler) GetItems(w http.ResponseWriter, r *http.Request) {
	playerID, ok := PlayerIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing authenticated player")
		return
	}

	items, err := h.service.GetInventoryItems(r.Context(), playerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"items": items,
	})
}

// Sync godoc
// @Summary      Sync game progress
// @Description  Submits click and depth-gain data from the client. Anti-cheat validation is applied server-side.
// @Tags         game
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      models.SyncPayload  true  "Progress payload"
// @Success      200   {object}  map[string]string   "status: synced"
// @Failure      400   {object}  APIError
// @Failure      401   {object}  APIError
// @Failure      403   {object}  APIError  "Anti-cheat violation"
// @Router       /api/game/sync [post]
func (h *GameHandler) Sync(w http.ResponseWriter, r *http.Request) {
	playerID, ok := PlayerIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing authenticated player")
		return
	}

	var payload models.SyncPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	err := h.service.SyncProgress(r.Context(), playerID, payload)
	if err != nil {
		if errors.Is(err, game.ErrAntiCheat) {
			writeError(w, http.StatusForbidden, err.Error())
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "synced"})
}

// GetCatalog godoc
// @Summary      Get store catalog
// @Description  Returns all available store items. Tries the Xsolla catalog API first, falls back to the local database. Source is indicated by the "source" field.
// @Tags         store
// @Produce      json
// @Success      200  {object}  map[string]any  "source and list of CatalogItems"
// @Failure      500  {object}  APIError
// @Router       /api/store/catalog [get]
func (h *StoreHandler) GetCatalog(w http.ResponseWriter, r *http.Request) {
	// Try Xsolla Catalog API first (with 5-min cache)
	if h.catalogFetcher != nil {
		xsollaItems, err := h.catalogFetcher.FetchCatalog(r.Context())
		if err == nil && len(xsollaItems) > 0 {
			// Check if gem packs (category "gems") are present from Xsolla.
			// VC packages often return empty if the virtual currency isn't
			// fully configured — fill from DB in that case.
			hasGemPacks := false
			for _, item := range xsollaItems {
				if item.Category == "gems" {
					hasGemPacks = true
					break
				}
			}
			if !hasGemPacks {
				dbItems, dbErr := h.service.GetCatalog(r.Context())
				if dbErr == nil {
					for _, dbi := range dbItems {
						if dbi.Category == "gems" && dbi.CurrencyType == "real" {
							xsollaItems = append(xsollaItems, CatalogItem{
								SKU:         dbi.SKU,
								Name:        dbi.Name,
								Category:    "gems",
								Currency:    "real",
								Price:       dbi.BasePrice,
								PriceStr:    fmt.Sprintf("$%.2f", dbi.BasePrice),
								GemsGranted: dbi.GemsGranted,
							})
						}
					}
				}
			}

			writeJSON(w, http.StatusOK, map[string]any{
				"source": "xsolla",
				"items":  xsollaItems,
			})
			return
		}
		if err != nil {
			log.Printf("xsolla catalog fetch failed, falling back to DB: %v", err)
		}
	}

	// Fallback: serve from local database
	items, err := h.service.GetCatalog(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"source": "database",
		"items":  items,
	})
}

// BuyGemItem godoc
// @Summary      Purchase a gem-priced item
// @Description  Deducts gems from the authenticated player's balance and grants the requested item.
// @Tags         store
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      buyGemItemRequest  true  "Item SKU to purchase"
// @Success      200   {object}  map[string]string  "status: purchased"
// @Failure      400   {object}  APIError
// @Failure      401   {object}  APIError
// @Router       /api/store/buy-gem-item [post]
func (h *StoreHandler) BuyGemItem(w http.ResponseWriter, r *http.Request) {
	playerID, ok := PlayerIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing authenticated player")
		return
	}

	var req buyGemItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if err := validateBuyGemItemRequest(req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.service.BuyGemItem(r.Context(), playerID, req.SKU); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "purchased"})
}

// XsollaWebhook godoc
// @Summary      Xsolla payment webhook
// @Description  Receives Xsolla payment notifications (user_validation, payment, refund). The request must carry a valid HMAC-SHA1 Signature header.
// @Tags         store
// @Accept       json
// @Produce      json
// @Param        Authorization  header    string  true  "Signature <sha1hex>"
// @Param        body           body      webhookNotification  true  "Xsolla notification payload"
// @Success      200            {object}  map[string]string  "status: accepted"
// @Failure      400            {object}  APIError
// @Failure      401            {object}  APIError
// @Router       /api/store/webhook/xsolla [post]
func (h *StoreHandler) XsollaWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "unable to read body")
		return
	}
	r.Body = io.NopCloser(bytes.NewReader(body))

	if !h.verifySignature(r.Header.Get("Authorization"), body) {
		log.Printf("webhook: signature verification failed (Authorization=%q)", r.Header.Get("Authorization"))
		writeError(w, http.StatusUnauthorized, "invalid webhook signature")
		return
	}

	var notification webhookNotification
	if err := json.Unmarshal(body, &notification); err != nil {
		log.Printf("webhook: failed to parse body: %v", err)
		writeError(w, http.StatusBadRequest, "invalid notification body")
		return
	}

	log.Printf("webhook: received notification_type=%s", notification.NotificationType)

	switch notification.NotificationType {
	case "user_validation":
		h.handleUserValidation(w, r, notification)
	case "payment":
		h.handlePaymentNotification(w, r, notification)
	case "refund":
		h.handleRefundNotification(w, notification)
	default:
		log.Printf("webhook: unhandled notification_type=%s", notification.NotificationType)
		writeJSON(w, http.StatusOK, map[string]string{"status": "accepted"})
	}
}

// login or register the user if they don't exist
func (h *StoreHandler) handleUserValidation(w http.ResponseWriter, r *http.Request, n webhookNotification) {
	if n.User == nil || n.User.ID == "" {
		writeError(w, http.StatusBadRequest, "missing user ID")
		return
	}

	_, err := h.service.GetPlayerByID(r.Context(), n.User.ID)
	if err != nil {
		// Player not found: auto-register so first-time buyers are accepted.
		// The user already passed Xsolla Login authentication to receive a valid token,
		// so we trust the identity and create the player record on the first purchase.
		username := n.User.Name
		if username == "" {
			username = n.User.Email
		}
		if username == "" {
			username = n.User.ID
		}
		if regErr := h.service.LoginOrRegister(r.Context(), n.User.ID, username, n.User.Email); regErr != nil {
			log.Printf("webhook: user_validation auto-register failed user=%s: %v", n.User.ID, regErr)
			writeError(w, http.StatusNotFound, "user not found")
			return
		}
		log.Printf("webhook: user_validation auto-registered user=%s", n.User.ID)
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "accepted"})
}

// ── Payment Notification ────────
func (h *StoreHandler) handlePaymentNotification(w http.ResponseWriter, r *http.Request, n webhookNotification) {
	if n.User == nil || n.User.ID == "" {
		writeError(w, http.StatusBadRequest, "missing user in payment notification")
		return
	}
	if n.Transaction == nil {
		writeError(w, http.StatusBadRequest, "missing transaction in payment notification")
		return
	}

	isDryRun := n.Transaction.DryRun == 1
	playerID := n.User.ID
	txnID := n.Transaction.ID

	var amount float64
	var currency string
	if n.Purchase != nil && n.Purchase.Total != nil {
		amount = n.Purchase.Total.Amount
		currency = n.Purchase.Total.Currency
	}

	// Collect all SKUs from the purchase
	var skus []string
	if n.Purchase != nil {
		if n.Purchase.VirtualItems != nil {
			for _, item := range n.Purchase.VirtualItems.Items {
				for i := 0; i < item.Quantity; i++ {
					skus = append(skus, item.SKU)
				}
			}
		}
		if n.Purchase.VirtualCurrency != nil && n.Purchase.VirtualCurrency.SKU != "" {
			skus = append(skus, n.Purchase.VirtualCurrency.SKU)
		}
	}

	if isDryRun {
		log.Printf("webhook: DRY RUN payment txn=%d player=%s skus=%v amount=%.2f %s", txnID, playerID, skus, amount, currency)
		writeJSON(w, http.StatusOK, map[string]string{"status": "accepted"})
		return
	}

	log.Printf("webhook: payment txn=%d player=%s skus=%v amount=%.2f %s", txnID, playerID, skus, amount, currency)

	for _, sku := range skus {
		if err := h.service.FulfillPurchase(r.Context(), playerID, sku, txnID, amount); err != nil {
			log.Printf("webhook: fulfillment failed for player=%s sku=%s txn=%d: %v", playerID, sku, txnID, err)
			writeError(w, http.StatusInternalServerError, "fulfillment error: "+err.Error())
			return
		}
		log.Printf("webhook: fulfilled sku=%s for player=%s txn=%d", sku, playerID, txnID)
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "accepted"})
}

// ── Refund Notification ────────
func (h *StoreHandler) handleRefundNotification(w http.ResponseWriter, n webhookNotification) {
	if n.Transaction != nil {
		log.Printf("webhook: refund received for txn=%d user=%s", n.Transaction.ID, n.User.ID)
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "accepted"})
}

// verifySignature validates the Xsolla webhook Authorization header.
// Xsolla format: "Authorization: Signature <sha1hex(json_body + webhook_secret)>"
func (h *StoreHandler) verifySignature(authHeader string, body []byte) bool {
	if h.webhookSecret == "" {
		// No secret configured — accept all (useful in local dev, warn in logs).
		log.Printf("webhook: XSOLLA_WEBHOOK_SECRET not set; skipping signature check")
		return true
	}
	const prefix = "Signature "
	if !strings.HasPrefix(authHeader, prefix) {
		return false
	}
	incoming := strings.TrimPrefix(authHeader, prefix)
	digest := sha1.New()
	digest.Write(body)
	digest.Write([]byte(h.webhookSecret))
	expected := hex.EncodeToString(digest.Sum(nil))
	return hmac.Equal([]byte(strings.ToLower(incoming)), []byte(strings.ToLower(expected)))
}
