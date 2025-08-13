package main

import (
    "log"
    "os"
    "os/signal"
    "syscall"

    "backend-go/internal/config"
    "backend-go/internal/logz"
    "backend-go/internal/queue"
    "backend-go/internal/worker"
    "github.com/joho/godotenv"
)

func main() {
    // Load .env if present
    _ = godotenv.Load(".env")

    cfg, err := config.Load()
    if err != nil {
        log.Fatalf("failed to load config: %v", err)
    }
    logger := logz.New(cfg.LogLevel)
    logger.Info().Msg("starting worker")
    logger.Info().Str("redis", cfg.RedisURL).Str("log_level", cfg.LogLevel).Msg("config preflight")

    // Asynq server + mux
    srv, mux, err := queue.NewServer(cfg, logger)
    if err != nil {
        logger.Fatal().Err(err).Msg("failed to create asynq server")
    }

    // Register handlers
    worker.RegisterHandlers(cfg, logger, mux)

    // Start server
    go func() {
        if err := srv.Start(mux); err != nil {
            logger.Fatal().Err(err).Msg("asynq server error")
        }
    }()

    // Shutdown handling
    stop := make(chan os.Signal, 1)
    signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
    <-stop
    logger.Info().Msg("shutting down worker...")
    // Asynq v0.25 has Shutdown without context and no Done channel
    srv.Shutdown()
    logger.Info().Msg("worker stopped")
}
