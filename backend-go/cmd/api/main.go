package main

import (
    "context"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "backend-go/internal/config"
    "backend-go/internal/db"
    httpserver "backend-go/internal/http"
    "backend-go/internal/logz"
    "backend-go/internal/queue"
    "github.com/joho/godotenv"
)

func main() {
    // Load .env if present
    _ = godotenv.Load(".env")

    // Load config
    cfg, err := config.Load()
    if err != nil {
        log.Fatalf("failed to load config: %v", err)
    }

    // Logger
    logger := logz.New(cfg.LogLevel)
    logger.Info().Msg("starting API server")

    // Preflight summary
    logger.Info().
        Str("addr", cfg.Address()).
        Str("log_level", cfg.LogLevel).
        Str("redis", cfg.RedisURL).
        Str("db", cfg.SafeDatabaseDSN()).
        Str("claude_path", cfg.ClaudePath).
        Str("repos_dir", cfg.ReposDir).
        Msg("config preflight")

    // Open DB (optional in demo, used by health)
    dbh, err := db.Open(context.Background(), cfg)
    if err != nil {
        logger.Error().Err(err).Msg("database connection failed")
    } else {
        if err := dbh.Ping(context.Background()); err != nil {
            logger.Error().Err(err).Msg("database ping failed")
        } else {
            logger.Info().Msg("database ping ok")
        }
        defer dbh.Close()
    }

    // Queue client (optional but used by prompt route)
    qClient, err := queue.NewClient(cfg)
    if err != nil {
        logger.Fatal().Err(err).Msg("failed to create queue client")
    }
    defer qClient.Close()

    // Build HTTP server
    router := httpserver.BuildRouter(cfg, logger, qClient, dbh)

    srv := &http.Server{
        Addr:              cfg.Address(),
        Handler:           router,
        ReadTimeout:       15 * time.Second,
        ReadHeaderTimeout: 10 * time.Second,
        WriteTimeout:      30 * time.Second,
        IdleTimeout:       60 * time.Second,
    }

    go func() {
        logger.Info().Str("addr", cfg.Address()).Msg("listening")
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            logger.Fatal().Err(err).Msg("server error")
        }
    }()

    // Graceful shutdown
    stop := make(chan os.Signal, 1)
    signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
    <-stop

    logger.Info().Msg("shutting down API server...")
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    if err := srv.Shutdown(ctx); err != nil {
        logger.Error().Err(err).Msg("graceful shutdown failed")
        _ = srv.Close()
    }
    logger.Info().Msg("API server stopped")
}
