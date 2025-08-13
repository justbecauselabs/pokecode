package http

import (
    "net/http"
    "time"

    "backend-go/internal/config"
    "backend-go/internal/db"
    "backend-go/internal/queue"

    "github.com/gin-contrib/cors"
    "github.com/gin-gonic/gin"
    "github.com/rs/zerolog"
)

// BuildRouter constructs the Gin engine with routes and middleware.
func BuildRouter(cfg *config.Config, logger zerolog.Logger, q *queue.Client, dbh *db.DB) *gin.Engine {
    gin.SetMode(gin.ReleaseMode)
    r := gin.New()
    r.Use(gin.Recovery())
    r.Use(gin.Logger())

    r.Use(cors.New(cors.Config{
        AllowAllOrigins: true,
        AllowMethods:     []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
        AllowHeaders:     []string{"Authorization", "Content-Type", "X-Request-ID"},
        MaxAge:           12 * time.Hour,
    }))

    // Health endpoints
    RegisterHealthRoutes(r, cfg, dbh)

    // Sessions + prompts routes (demo)
    RegisterSessionRoutes(r, cfg, dbh)
    RegisterPromptRoutes(r, cfg, logger, q)

    // Root
    r.GET("/", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{
            "name":    "Claude Code Mobile API (Go demo)",
            "version": "0.1.0",
            "status":  "running",
            "time":    time.Now().UTC().Format(time.RFC3339),
        })
    })

    return r
}
