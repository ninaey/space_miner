package handlers

import "net/http"

type APIError struct {
	Message string `json:"error"`
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, APIError{Message: message})
}
