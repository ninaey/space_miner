package config

import (
	"log"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port                string
	DatabaseURL         string
	XsollaJWKSURL       string
	XsollaIssuer        string
	XsollaAudience      string
	XsollaProjectID     int
	XsollaMerchantID    int
	XsollaAPIKey        string
	XsollaCatalogURL    string
	XsollaWebhookSecret string
	// PayStation token (Store v3 admin/payment/token)
	XsollaPayStationSandbox  bool
	XsollaPayStationCurrency string // empty: omit — Xsolla uses catalog/regional default
	XsollaPayStationLanguage string
	XsollaPayStationCountry  string // empty: omit — use X-User-Ip / user profile
	AllowedOrigins           string
	StaticDir                string
}

func Load() Config {
	projectID, _ := strconv.Atoi(os.Getenv("XSOLLA_PROJECT_ID"))
	merchantID, _ := strconv.Atoi(os.Getenv("XSOLLA_MERCHANT_ID"))

	cfg := Config{
		Port:                getEnv("PORT", "8080"),
		DatabaseURL:         getEnv("DATABASE_URL", "postgres://postgres:123456@localhost:5432/spaceminergame?sslmode=disable"),
		XsollaJWKSURL:       os.Getenv("XSOLLA_JWKS_URL"),
		XsollaIssuer:        os.Getenv("XSOLLA_ISSUER"),
		XsollaAudience:      os.Getenv("XSOLLA_AUDIENCE"),
		XsollaProjectID:     projectID,
		XsollaMerchantID:    merchantID,
		XsollaAPIKey:        os.Getenv("XSOLLA_API_KEY"),
		XsollaCatalogURL:    os.Getenv("XSOLLA_CATALOG_URL"),
		XsollaWebhookSecret: os.Getenv("XSOLLA_WEBHOOK_SECRET"),
		XsollaPayStationSandbox:  parseEnvBool("XSOLLA_PAYSTATION_SANDBOX", true),
		XsollaPayStationCurrency: strings.TrimSpace(os.Getenv("XSOLLA_PAYSTATION_CURRENCY")),
		XsollaPayStationLanguage: getEnv("XSOLLA_PAYSTATION_LANGUAGE", "en"),
		XsollaPayStationCountry:  strings.TrimSpace(strings.ToUpper(os.Getenv("XSOLLA_PAYSTATION_COUNTRY"))),
		AllowedOrigins:           getEnv("ALLOWED_ORIGINS", "*"),
		StaticDir:                os.Getenv("STATIC_DIR"),
	}

	if cfg.XsollaJWKSURL == "" {
		log.Println("warning: XSOLLA_JWKS_URL is empty; JWT middleware will reject all tokens")
	}
	if cfg.XsollaProjectID == 0 {
		log.Println("warning: XSOLLA_PROJECT_ID is empty; catalog will use database fallback")
	}
	if cfg.XsollaAPIKey == "" {
		log.Println("warning: XSOLLA_API_KEY is empty; PayStation token creation will be unavailable")
	}

	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func parseEnvBool(key string, defaultVal bool) bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if v == "" {
		return defaultVal
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		if v == "no" || v == "n" || v == "off" || v == "0" {
			return false
		}
		if v == "yes" || v == "y" || v == "on" || v == "1" {
			return true
		}
		return defaultVal
	}
	return b
}
