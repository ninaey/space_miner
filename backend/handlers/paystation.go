package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
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
	ID    v3Field `json:"id"`
	Name  v3Field `json:"name,omitempty"`
	Email v3Field `json:"email,omitempty"`
}

type v3Field struct {
	Value string `json:"value"`
}

type v3Settings struct {
	Language string `json:"language,omitempty"`
	Currency string `json:"currency,omitempty"`
	UI       *v3UI  `json:"ui,omitempty"`
}

type v3UI struct {
	Size  string `json:"size,omitempty"`
	Theme string `json:"theme,omitempty"`
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

// CreatePayment creates a PayStation token via Xsolla v3 Admin Payment Token API.
func (h *StoreHandler) CreatePayment(w http.ResponseWriter, r *http.Request) {
	playerID, ok := PlayerIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "missing authenticated player")
		return
	}

	if h.apiKey == "" || h.projectID == 0 {
		writeError(w, http.StatusServiceUnavailable, "PayStation not configured: missing API key or project ID")
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
		},
		Settings: &v3Settings{
			Language: "en",
			Currency: "USD",
			UI: &v3UI{
				Size:  "medium",
				Theme: "dark",
			},
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

	url := fmt.Sprintf("https://api.xsolla.com/v3/project/%d/admin/payment/token", h.projectID)
	httpReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create HTTP request")
		return
	}

	credentials := fmt.Sprintf("%d:%s", h.projectID, h.apiKey)
	httpReq.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(credentials)))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := h.httpClient.Do(httpReq)
	if err != nil {
		log.Printf("paystation: token request failed: %v", err)
		writeError(w, http.StatusBadGateway, "failed to contact Xsolla")
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		log.Printf("paystation: xsolla returned %d: %s", resp.StatusCode, string(respBody))
		writeError(w, http.StatusBadGateway, fmt.Sprintf("Xsolla token creation failed (status %d)", resp.StatusCode))
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
