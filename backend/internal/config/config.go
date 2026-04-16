package config

import (
	"log"
	"os"
	"strconv"
)

type Config struct {
	Port                string
	DatabaseURL         string
	XsollaJWKSURL       string
	XsollaIssuer        string
	XsollaAudience      string
	XsollaProjectID     int
	XsollaCatalogURL    string
	XsollaWebhookSecret string
	AllowedOrigins      string
	StaticDir           string
}

func Load() Config {
	projectID, _ := strconv.Atoi(os.Getenv("XSOLLA_PROJECT_ID"))

	cfg := Config{
		Port:                getEnv("PORT", "8080"),
		DatabaseURL:         getEnv("DATABASE_URL", "postgres://postgres:123456@localhost:5432/spaceminergame?sslmode=disable"),
		XsollaJWKSURL:       os.Getenv("XSOLLA_JWKS_URL"),
		XsollaIssuer:        os.Getenv("XSOLLA_ISSUER"),
		XsollaAudience:      os.Getenv("XSOLLA_AUDIENCE"),
		XsollaProjectID:     projectID,
		XsollaCatalogURL:    os.Getenv("XSOLLA_CATALOG_URL"),
		XsollaWebhookSecret: os.Getenv("XSOLLA_WEBHOOK_SECRET"),
		AllowedOrigins:      getEnv("ALLOWED_ORIGINS", "*"),
		StaticDir:           os.Getenv("STATIC_DIR"),
	}

	if cfg.XsollaJWKSURL == "" {
		log.Println("warning: XSOLLA_JWKS_URL is empty; JWT middleware will reject all tokens")
	}
	if cfg.XsollaProjectID == 0 {
		log.Println("warning: XSOLLA_PROJECT_ID is empty; catalog will use database fallback")
	}

	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
