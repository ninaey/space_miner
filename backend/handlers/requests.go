package handlers

// authRequest is the body for POST /api/auth/login and /api/auth/register.
type authRequest struct {
	UserID   string `json:"user_id"  example:"user-abc-123"`
	Username string `json:"username" example:"AstroMiner42"`
	Email    string `json:"email"    example:"miner@space.io"`
}

// buyGemItemRequest is the body for POST /api/store/buy-gem-item.
type buyGemItemRequest struct {
	SKU string `json:"sku" example:"drill_upgrade_basic"`
}
