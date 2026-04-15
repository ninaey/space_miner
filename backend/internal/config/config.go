package config

import (
	"log"
	"os"
)

type Config struct {
	Port                string
	DatabaseURL         string
	XsollaJWKSURL       string
	XsollaIssuer        string
	XsollaAudience      string
	XsollaCatalogURL    string
	XsollaWebhookSecret string
	AllowedOrigins      string
}

func Load() Config {
	cfg := Config{
		Port:                getEnv("PORT", "8080"),
		DatabaseURL:         getEnv("DATABASE_URL", "postgres://postgres:123456@localhost:5432/spaceminergame?sslmode=disable"),
		XsollaJWKSURL:       os.Getenv("XSOLLA_JWKS_URL"),
		XsollaIssuer:        os.Getenv("XSOLLA_ISSUER"),
		XsollaAudience:      os.Getenv("XSOLLA_AUDIENCE"),
		XsollaCatalogURL:    os.Getenv("XSOLLA_CATALOG_URL"),
		XsollaWebhookSecret: os.Getenv("XSOLLA_WEBHOOK_SECRET"),
		AllowedOrigins:      getEnv("ALLOWED_ORIGINS", "*"),
	}

	if cfg.XsollaJWKSURL == "" {
		log.Println("warning: XSOLLA_JWKS_URL is empty; JWT middleware will reject all tokens")
	}

	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
