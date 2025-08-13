package worker

import (
    "context"
    "encoding/json"
    "time"

    "backend-go/internal/claude"
    "backend-go/internal/config"
    "backend-go/internal/queue"
    "github.com/hibiken/asynq"
    redis "github.com/redis/go-redis/v9"
    "github.com/rs/zerolog"
)

func RegisterHandlers(cfg *config.Config, logger zerolog.Logger, mux *asynq.ServeMux) {
    mux.HandleFunc(queue.TypePrompt, func(ctx context.Context, t *asynq.Task) error {
        var p queue.PromptTask
        if err := json.Unmarshal(t.Payload(), &p); err != nil {
            return err
        }

        // Prepare pubsub channel and publisher
        channel := "claude-code:" + p.SessionID + ":" + p.PromptID
        rdb := redis.NewClient(&redis.Options{Addr: redisAddrFromURL(cfg.RedisURL)})
        defer rdb.Close()

        publish := func(event any) {
            data, _ := json.Marshal(event)
            _ = rdb.Publish(ctx, channel, string(data)).Err()
        }

        publish(ginMsg("message", map[string]any{
            "type":      "message",
            "content":   "Initializing Claude runner...",
            "timestamp": time.Now().UTC().Format(time.RFC3339),
        }))

        runner := claude.NewRunner(cfg, logger)
        res := runner.Run(ctx, claude.RunOptions{
            SessionID:   p.SessionID,
            PromptID:    p.PromptID,
            Prompt:      p.Prompt,
            ProjectPath: p.ProjectPath,
        }, publish)

        if !res.Success {
            publish(ginMsg("error", map[string]any{
                "type":      "error",
                "error":     res.Error,
                "timestamp": time.Now().UTC().Format(time.RFC3339),
            }))
            return asynq.SkipRetry
        }

        publish(ginMsg("result", map[string]any{
            "type":      "result",
            "success":   true,
            "timestamp": time.Now().UTC().Format(time.RFC3339),
        }))
        return nil
    })
}

func ginMsg(typ string, data any) map[string]any { return map[string]any{"type": typ, "data": data} }

func redisAddrFromURL(url string) string {
    const prefix = "redis://"
    if len(url) > len(prefix) && url[:len(prefix)] == prefix {
        return url[len(prefix):]
    }
    return url
}

