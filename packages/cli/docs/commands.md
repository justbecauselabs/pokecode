# CLI Commands

Reference for the `pokecode` CLI.

## serve

Start the API server (and worker) in the foreground or as a daemon.

- `-p, --port <port>`: server port (default `3001`, must be 1024–65535)
- `-h, --host <host>`: `localhost`, `127.0.0.1`, `0.0.0.0`, or IPv4 (default `0.0.0.0`)
- `-d, --daemon`: run in background; PID and metadata saved under `~/.pokecode`
- `--log-level <level>`: `trace|debug|info|warn|error` (default `info`)

Examples:
- `pokecode serve`
- `pokecode serve --daemon --port 3002 --log-level debug`

## status

Show daemon status if running via `--daemon`. Displays URL, PID, uptime, log path and attempts a `/health` probe.

Examples:
- `pokecode status`

## stop

Stop a running daemon.

- `--force`: send `SIGKILL` if graceful stop fails

Examples:
- `pokecode stop`
- `pokecode stop --force`

## logs

Show or follow the daemon log file (`~/.pokecode/pokecode.log`).

- `-f, --follow`: follow the log (stream)
- `-n, --lines <number>`: number of lines to show (default `50`)

Examples:
- `pokecode logs`
- `pokecode logs -f -n 200`

## setup

Interactive helper to set `claudeCodePath` by asking for your `claude` path and validating the expected `@anthropic-ai/claude-code/cli.js` file.

Examples:
- `pokecode setup`

## Config Interaction

- Runtime overrides: `serve` flags update port/host/log level via `overrideConfig()`.
- File config: edit `~/.pokecode/config.json` (see core config reference).

