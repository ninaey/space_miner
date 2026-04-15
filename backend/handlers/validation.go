package handlers

import (
	"errors"
	"strings"
)

func validateAuthRequest(req authRequest) error {
	if strings.TrimSpace(req.UserID) == "" || strings.TrimSpace(req.Username) == "" {
		return errors.New("user_id and username are required")
	}
	return nil
}

func validateBuyGemItemRequest(req buyGemItemRequest) error {
	if strings.TrimSpace(req.SKU) == "" {
		return errors.New("sku is required")
	}
	return nil
}
