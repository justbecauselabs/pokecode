package main

import (
    "context"
    "encoding/json"
    "log"
    "path/filepath"

    "backend-go/internal/config"
    "backend-go/internal/db"
    "backend-go/internal/repo"
    "github.com/joho/godotenv"
)

func main() {
    _ = godotenv.Load(".env")
    cfg, err := config.Load()
    if err != nil { log.Fatalf("config: %v", err) }
    d, err := db.Open(context.Background(), cfg)
    if err != nil { log.Fatalf("db open: %v", err) }
    defer d.Close()

    meta, _ := json.Marshal(map[string]any{"allowedTools": []string{"bash", "ls"}})
    project := filepath.Join(cfg.ReposDir, "demo")
    s, err := repo.CreateSession(context.Background(), d, repo.CreateSessionInput{ProjectPath: project, Metadata: meta})
    if err != nil { log.Fatalf("seed create session: %v", err) }
    log.Printf("seeded session: %s", s.ID)
}

