package claude

import (
    "bufio"
    "bytes"
    "context"
    "encoding/json"
    "errors"
    "os/exec"
    "time"

    "backend-go/internal/config"
    "github.com/rs/zerolog"
)

type RunOptions struct {
    SessionID   string
    PromptID    string
    Prompt      string
    ProjectPath string
}

type Result struct {
    Success bool
    Error   string
}

// Runner executes the Claude Code CLI and streams JSONL events (demo: simulates when CLI path is unset).
type Runner struct {
    cfg    *config.Config
    logger zerolog.Logger
}

func NewRunner(cfg *config.Config, logger zerolog.Logger) *Runner {
    return &Runner{cfg: cfg, logger: logger}
}

func (r *Runner) Run(ctx context.Context, opts RunOptions, publish func(any)) Result {
    // If no CLI path configured, simulate a small event stream
    if r.cfg.ClaudePath == "" {
        r.simulate(ctx, opts, publish)
        return Result{Success: true}
    }

    // Otherwise, try to run the CLI via node (adjust to your CLI invocation)
    // Example: node /path/to/claude-code.js query --json --prompt "..."
    cmd := exec.CommandContext(ctx, "node", r.cfg.ClaudePath, "query", "--json")
    cmd.Dir = opts.ProjectPath

    stdout, err := cmd.StdoutPipe()
    if err != nil {
        return Result{Success: false, Error: err.Error()}
    }
    stderr, err := cmd.StderrPipe()
    if err != nil {
        return Result{Success: false, Error: err.Error()}
    }

    if err := cmd.Start(); err != nil {
        return Result{Success: false, Error: err.Error()}
    }

    // stream stderr lines as debug/system events
    go func() {
        s := bufio.NewScanner(stderr)
        for s.Scan() {
            publish(map[string]any{"type": "system", "data": map[string]any{"stderr": s.Text()}})
        }
    }()

    // stream stdout JSONL
    scan := bufio.NewScanner(stdout)
    for scan.Scan() {
        line := bytes.TrimSpace(scan.Bytes())
        if len(line) == 0 {
            continue
        }
        // In a real implementation, define precise structs and decode strictly
        var raw map[string]any
        if err := json.Unmarshal(line, &raw); err != nil {
            // publish parse error but continue
            publish(map[string]any{"type": "error", "data": map[string]any{"parse": err.Error()}})
            continue
        }
        publish(raw)
    }

    if err := cmd.Wait(); err != nil {
        // If killed due to context
        if errors.Is(ctx.Err(), context.Canceled) {
            return Result{Success: false, Error: "canceled"}
        }
        return Result{Success: false, Error: err.Error()}
    }

    return Result{Success: true}
}

func (r *Runner) simulate(ctx context.Context, opts RunOptions, publish func(any)) {
    // Minimal fake streaming events for demo purposes
    publish(map[string]any{"type": "message_start", "data": map[string]any{"session_id": opts.SessionID}})
    publish(map[string]any{"type": "content_block_start", "data": map[string]any{"idx": 0}})
    publish(map[string]any{"type": "text_delta", "data": map[string]any{"text": "Working on: " + opts.Prompt}})
    time.Sleep(300 * time.Millisecond)
    publish(map[string]any{"type": "tool_use", "data": map[string]any{"tool": "bash", "params": map[string]any{"command": "ls -la"}}})
    time.Sleep(300 * time.Millisecond)
    publish(map[string]any{"type": "tool_result", "data": map[string]any{"tool": "bash", "result": "README.md\nmain.go"}})
    time.Sleep(300 * time.Millisecond)
    publish(map[string]any{"type": "content_block_stop", "data": map[string]any{"idx": 0}})
    publish(map[string]any{"type": "message_stop", "data": map[string]any{"reason": "end_turn"}})
}

