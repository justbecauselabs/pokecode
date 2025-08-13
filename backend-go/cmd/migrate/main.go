package main

import (
    "context"
    "log"
    "path/filepath"

    "backend-go/internal/config"
    "backend-go/internal/db"
    "backend-go/internal/migrate"
    "github.com/joho/godotenv"
)

func main() {
    _ = godotenv.Load(".env")
    cfg, err := config.Load()
    if err != nil { log.Fatalf("config: %v", err) }
    d, err := db.Open(context.Background(), cfg)
    if err != nil { log.Fatalf("db open: %v", err) }
    defer d.Close()
    dir := filepath.Join("sql", "migrations")
    if err := migrate.Up(context.Background(), d, dir); err != nil {
        log.Fatalf("migrate up: %v", err)
    }
}

