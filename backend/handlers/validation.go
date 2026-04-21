package handlers

import (
	"errors"
	"strings"

	"github.com/google/uuid"
)

func validateAuthRequest(req authRequest) error {
	if strings.TrimSpace(req.UserID) == "" || strings.TrimSpace(req.Username) == "" {
		return errors.New("user_id and username are required")
	}
	if _, err := uuid.Parse(req.UserID); err != nil {
		return errors.New("user_id must be a valid UUID (e.g. 550e8400-e29b-41d4-a716-446655440000)")
	}
	return nil
}

func validateBuyGemItemRequest(req buyGemItemRequest) error {
	if strings.TrimSpace(req.SKU) == "" {
		return errors.New("sku is required")
	}
	return nil
}
