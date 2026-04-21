package handlers

// authRequest is the body for POST /api/auth/login and /api/auth/register.
type authRequest struct {
	UserID   string `json:"user_id"  example:"550e8400-e29b-41d4-a716-446655440000"`
	Username string `json:"username" example:"AstroMiner42"`
	Email    string `json:"email"    example:"miner@space.io"`
}

// buyGemItemRequest is the body for POST /api/store/buy-gem-item.
type buyGemItemRequest struct {
	SKU string `json:"sku" example:"drill_upgrade_basic"`
}
