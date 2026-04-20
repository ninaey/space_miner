package handlers

import "net/http"

// APIError is the standard error response body.
type APIError struct {
	Message string `json:"error" example:"something went wrong"`
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, APIError{Message: message})
}
