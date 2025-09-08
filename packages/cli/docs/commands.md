# CLI Commands

Reference for the `pokecode` CLI.

## serve

Start the API server (and worker) with an interactive TUI.

- `-p, --port <port>`: server port (default `3001`, must be 1024–65535)
- `-h, --host <host>`: `localhost`, `127.0.0.1`, `0.0.0.0`, or IPv4 (default `0.0.0.0`)
- `--log-level <level>`: `trace|debug|info|warn|error` (default `info`)

Examples:
- `pokecode serve`
- `pokecode serve --port 3002 --log-level debug`

## status/stop

Removed. The server runs in the foreground when using the direct dev script; use Ctrl+C to exit. The TUI mode also exits with `q` or Ctrl+C.

## logs

Show or follow the log file (`~/.pokecode/pokecode.log`).

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
