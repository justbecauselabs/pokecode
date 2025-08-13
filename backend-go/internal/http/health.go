package http

import (
    "context"
    "net/http"
    "time"

    "backend-go/internal/config"
    "backend-go/internal/db"
    "github.com/gin-gonic/gin"
    redis "github.com/redis/go-redis/v9"
)

func RegisterHealthRoutes(r *gin.Engine, cfg *config.Config, dbh *db.DB) {
    r.GET("/health", func(c *gin.Context) {
        ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
        defer cancel()

        services := map[string]string{
            "redis": "unknown",
            "database": "unknown",
        }

        // Check Redis
        rdb := redis.NewClient(&redis.Options{Addr: redisAddrFromURL(cfg.RedisURL)})
        if err := rdb.Ping(ctx).Err(); err != nil {
            services["redis"] = "unhealthy"
        } else {
            services["redis"] = "healthy"
        }
        _ = rdb.Close()

        // Check DB if available
        if dbh != nil {
            if err := dbh.Ping(ctx); err != nil {
                services["database"] = "unhealthy"
            } else {
                services["database"] = "healthy"
            }
        } else {
            services["database"] = "unhealthy"
        }

        allHealthy := true
        for _, v := range services {
            if v != "healthy" {
                allHealthy = false
                break
            }
        }

        status := http.StatusOK
        if !allHealthy {
            status = http.StatusServiceUnavailable
        }

        c.JSON(status, gin.H{
            "status":   map[bool]string{true: "healthy", false: "unhealthy"}[allHealthy],
            "timestamp": time.Now().UTC().Format(time.RFC3339),
            "services": services,
            "version":  "0.1.0",
            "uptime":   0, // left simple in demo
        })
    })

    r.GET("/live", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "ok", "timestamp": time.Now().UTC().Format(time.RFC3339)})
    })

    r.GET("/ready", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "ready", "timestamp": time.Now().UTC().Format(time.RFC3339)})
    })
}

// redisAddrFromURL converts a redis://host:port URL to host:port form for go-redis simple demo.
func redisAddrFromURL(url string) string {
    // Minimal: support redis://host:port only
    const prefix = "redis://"
    if len(url) > len(prefix) && url[:len(prefix)] == prefix {
        return url[len(prefix):]
    }
    return url
}
