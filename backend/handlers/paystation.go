package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"slices"
	"strings"
)

// ── PayStation token creation (Xsolla v3 Admin Token API) ────────

type createPaymentRequest struct {
	SKU string `json:"sku"`
}

type v3TokenRequest struct {
	User            v3User            `json:"user"`
	Settings        *v3Settings       `json:"settings,omitempty"`
	Purchase        v3Purchase        `json:"purchase"`
	Sandbox         bool              `json:"sandbox"`
	CustomParameters map[string]string `json:"custom_parameters,omitempty"`
}

type v3User struct {
	ID      v3Field    `json:"id"`
	Name    v3Field    `json:"name,omitempty"`
	Email   v3Field    `json:"email,omitempty"`
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

type xsollaErrorResponse struct {
	ErrorMessage string `json:"errorMessage"`
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

	var missing []string
	if h.apiKey == "" {
		missing = append(missing, "XSOLLA_API_KEY")
	}
	if h.projectID == 0 {
		missing = append(missing, "XSOLLA_PROJECT_ID")
	}
	if h.merchantID == 0 {
		missing = append(missing, "XSOLLA_MERCHANT_ID")
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

	tokenReq := v3TokenRequest{
		User: v3User{
			ID:   v3Field{Value: playerID},
			Name: v3Field{Value: player.Username},
			Country: &v3Country{
				Value:       "US",
				AllowModify: true,
			},
		},
		Settings: &v3Settings{
			Language: "en",
			Currency: "USD",
		},
		Purchase: v3Purchase{
			Items: []v3PurchaseItem{
				{SKU: req.SKU, Quantity: 1},
			},
		},
		Sandbox: true,
		CustomParameters: map[string]string{
			"sku": req.SKU,
		},
	}

	if player.Email != "" {
		tokenReq.User.Email = v3Field{Value: player.Email}
	}

	body, err := json.Marshal(tokenReq)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to build token request")
		return
	}

	url := fmt.Sprintf("https://store.xsolla.com/api/v3/project/%d/admin/payment/token", h.projectID)
	httpReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create HTTP request")
		return
	}

	credentials := fmt.Sprintf("%d:%s", h.merchantID, h.apiKey)
	httpReq.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(credentials)))
	httpReq.Header.Set("Content-Type", "application/json")

	if ip := clientIP(r); ip != "" {
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
		if err := json.Unmarshal(respBody, &xsErr); err == nil && xsErr.ErrorMessage != "" {
			details = fmt.Sprintf("%s: %s", details, xsErr.ErrorMessage)
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
	})
}

// clientIP extracts the best-guess public IP of the caller so Xsolla can
// detect the user's country/currency when creating a payment token.
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

// ── Webhook notification types and parsing ───────────────────────

type webhookNotification struct {
	NotificationType string               `json:"notification_type"`
	User             *webhookUser         `json:"user,omitempty"`
	Transaction      *webhookTransaction  `json:"transaction,omitempty"`
	Purchase         *webhookPurchase     `json:"purchase,omitempty"`
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
