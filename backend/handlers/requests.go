package handlers

type authRequest struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

type buyGemItemRequest struct {
	SKU string `json:"sku"`
}
