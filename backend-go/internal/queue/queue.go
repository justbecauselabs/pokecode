package queue

import (
    "context"
    "encoding/json"

    "backend-go/internal/config"
    "github.com/hibiken/asynq"
    "github.com/rs/zerolog"
)

const (
    TypePrompt = "claude:prompt"
)

type Client struct {
    asynq *asynq.Client
}

func NewClient(cfg *config.Config) (*Client, error) {
    opt, err := asynq.ParseRedisURI(cfg.RedisURL)
    if err != nil {
        return nil, err
    }
    c := asynq.NewClient(opt)
    return &Client{asynq: c}, nil
}

func (c *Client) Close() error { return c.asynq.Close() }

// Task payloads
type PromptTask struct {
    SessionID   string `json:"sessionId"`
    PromptID    string `json:"promptId"`
    Prompt      string `json:"prompt"`
    ProjectPath string `json:"projectPath"`
    MessageID   string `json:"messageId"`
}

func (c *Client) EnqueuePrompt(ctx context.Context, p PromptTask) error {
    payload, err := json.Marshal(p)
    if err != nil {
        return err
    }
    task := asynq.NewTask(TypePrompt, payload)
    _, err = c.asynq.EnqueueContext(ctx, task, asynq.MaxRetry(5))
    return err
}

// Server
func NewServer(cfg *config.Config, logger zerolog.Logger) (*asynq.Server, *asynq.ServeMux, error) {
    opt, err := asynq.ParseRedisURI(cfg.RedisURL)
    if err != nil {
        return nil, nil, err
    }
    srv := asynq.NewServer(opt, asynq.Config{
        Concurrency: 5,
    })
    mux := asynq.NewServeMux()
    return srv, mux, nil
}
