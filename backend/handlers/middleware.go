package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/MicahParks/keyfunc/v2"
	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const playerIDContextKey contextKey = "player_id"

type JWTValidator struct {
	jwks     *keyfunc.JWKS
	issuer   string
	audience string
}

func NewJWTValidator(jwksURL, issuer, audience string) (*JWTValidator, error) {
	if jwksURL == "" {
		return nil, errors.New("jwks url is required")
	}

	jwks, err := keyfunc.Get(jwksURL, keyfunc.Options{})
	if err != nil {
		return nil, err
	}

	return &JWTValidator{
		jwks:     jwks,
		issuer:   issuer,
		audience: audience,
	}, nil
}

func (v *JWTValidator) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == "" || tokenString == authHeader {
			http.Error(w, "missing bearer token", http.StatusUnauthorized)
			return
		}

		token, err := jwt.Parse(tokenString, v.jwks.Keyfunc)
		if err != nil || !token.Valid {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, "invalid claims", http.StatusUnauthorized)
			return
		}

		if v.issuer != "" && !verifyIssuer(claims, v.issuer) {
			http.Error(w, "invalid issuer", http.StatusUnauthorized)
			return
		}
		if v.audience != "" && !verifyAudience(claims, v.audience) {
			http.Error(w, "invalid audience", http.StatusUnauthorized)
			return
		}

		playerID, _ := claims["sub"].(string)
		if playerID == "" {
			http.Error(w, "missing subject claim", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), playerIDContextKey, playerID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func PlayerIDFromContext(ctx context.Context) (string, bool) {
	playerID, ok := ctx.Value(playerIDContextKey).(string)
	return playerID, ok
}

func CORS(allowedOrigins string) func(http.Handler) http.Handler {
	origins := strings.Split(allowedOrigins, ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if isAllowedOrigin(origin, origins) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization,Content-Type,X-Signature")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func isAllowedOrigin(origin string, allowed []string) bool {
	if len(allowed) == 0 {
		return false
	}
	for _, item := range allowed {
		if item == "*" || item == origin {
			return true
		}
	}
	return false
}

func verifyIssuer(claims jwt.MapClaims, expected string) bool {
	issuer, _ := claims["iss"].(string)
	return issuer == expected
}

func verifyAudience(claims jwt.MapClaims, expected string) bool {
	if audString, ok := claims["aud"].(string); ok {
		return audString == expected
	}

	if audList, ok := claims["aud"].([]any); ok {
		for _, candidate := range audList {
			if audValue, ok := candidate.(string); ok && audValue == expected {
				return true
			}
		}
	}

	return false
}
