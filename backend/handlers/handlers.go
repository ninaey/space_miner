package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
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
	httpClient     *http.Client
	catalogFetcher *XsollaCatalogFetcher
}

func NewAuthHandler(service *game.Service) *AuthHandler {
	return &AuthHandler{service: service}
}

func NewGameHandler(service *game.Service) *GameHandler {
	return &GameHandler{service: service}
}

func NewStoreHandler(service *game.Service, catalogURL, webhookSecret string, projectID int) *StoreHandler {
	return &StoreHandler{
		service:        service,
		catalogURL:     catalogURL,
		webhookSecret:  webhookSecret,
		catalogFetcher: NewXsollaCatalogFetcher(projectID),
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
