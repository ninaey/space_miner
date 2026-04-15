package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
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
	service       *game.Service
	catalogURL    string
	webhookSecret string
	httpClient    *http.Client
}

func NewAuthHandler(service *game.Service) *AuthHandler {
	return &AuthHandler{service: service}
}

func NewGameHandler(service *game.Service) *GameHandler {
	return &GameHandler{service: service}
}

func NewStoreHandler(service *game.Service, catalogURL, webhookSecret string) *StoreHandler {
	return &StoreHandler{
		service:       service,
		catalogURL:    catalogURL,
		webhookSecret: webhookSecret,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	h.upsertPlayer(w, r)
}

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

func (h *StoreHandler) GetCatalog(w http.ResponseWriter, r *http.Request) {
	if h.catalogURL != "" {
		req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, h.catalogURL, nil)
		if err == nil {
			resp, err := h.httpClient.Do(req)
			if err == nil && resp.StatusCode == http.StatusOK {
				defer resp.Body.Close()
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				_, _ = io.Copy(w, resp.Body)
				return
			}
		}
	}

	items, err := h.service.GetCatalog(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

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

func (h *StoreHandler) XsollaWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "unable to read body")
		return
	}
	r.Body = io.NopCloser(bytes.NewReader(body))

	if !h.verifySignature(r.Header.Get("X-Signature"), body) {
		writeError(w, http.StatusUnauthorized, "invalid webhook signature")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "accepted"})
}

func (h *StoreHandler) verifySignature(signatureHeader string, body []byte) bool {
	if h.webhookSecret == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(h.webhookSecret))
	_, _ = mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(strings.ToLower(signatureHeader)), []byte(strings.ToLower(expected)))
}
