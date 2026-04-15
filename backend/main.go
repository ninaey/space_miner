package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"spacecolonyminer/backend/handlers"
	"spacecolonyminer/backend/internal/config"
	"spacecolonyminer/backend/internal/game"
	"spacecolonyminer/backend/store"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	cfg := config.Load()

	ctx := context.Background()
	dbPool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connection error: %v", err)
	}
	defer dbPool.Close()

	repo := store.NewPostgresStore(dbPool)
	gameService := game.NewService(repo)
	authHandler := handlers.NewAuthHandler(gameService)
	gameHandler := handlers.NewGameHandler(gameService)
	storeHandler := handlers.NewStoreHandler(gameService, cfg.XsollaCatalogURL, cfg.XsollaWebhookSecret)

	jwtValidator, err := handlers.NewJWTValidator(cfg.XsollaJWKSURL, cfg.XsollaIssuer, cfg.XsollaAudience)
	if err != nil {
		log.Printf("jwt middleware initialization error: %v", err)
	}

	router := chi.NewRouter()
	router.Use(chimiddleware.RequestID)
	router.Use(chimiddleware.RealIP)
	router.Use(chimiddleware.Recoverer)
	router.Use(chimiddleware.Logger)
	router.Use(handlers.CORS(cfg.AllowedOrigins))

	router.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	router.Route("/auth", func(r chi.Router) {
		r.Post("/login", authHandler.Login)
		r.Post("/register", authHandler.Register)
	})

	router.Route("/store", func(r chi.Router) {
		r.Get("/catalog", storeHandler.GetCatalog)
		r.Post("/webhook/xsolla", storeHandler.XsollaWebhook)
	})

	router.Group(func(r chi.Router) {
		r.Use(requireJWT(jwtValidator))
		r.Route("/game", func(gr chi.Router) {
			gr.Get("/state", gameHandler.GetState)
			gr.Post("/sync", gameHandler.Sync)
		})
		r.Post("/store/buy-gem-item", storeHandler.BuyGemItem)
	})

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("api server listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	stopCtx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	<-stopCtx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown error: %v", err)
	}
}

func requireJWT(validator *handlers.JWTValidator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		if validator == nil {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				http.Error(w, "jwt validator unavailable", http.StatusUnauthorized)
			})
		}
		return validator.AuthMiddleware(next)
	}
}
