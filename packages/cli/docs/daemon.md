# Daemon Mode

How the `pokecode` daemon works and how to manage it.

## Files

- PID: `~/.pokecode/pokecode.pid`
- Daemon info: `~/.pokecode/daemon.json` (PID, host, port, startTime)
- Logs: `~/.pokecode/pokecode.log`

All are created with `0600` permissions.

## Start

- `pokecode serve --daemon`
  - Spawns a detached child process of the same binary/script with `--internal-run-server`
  - Stdout/stderr are redirected to the log file
  - Writes PID and daemon info for later inspection

## Stop

- `pokecode stop` — sends `SIGTERM`, waits briefly, force‑kills if needed
- `pokecode stop --force` — sends `SIGKILL` directly
- On stop, cleans up PID and daemon info files

## Status & Logs

- `pokecode status` — checks PID, validates process, reads daemon info, pings `/health`
- `pokecode logs` / `pokecode logs -f` — shows or tails the log file

## Notes

- On Unix, process validation uses `/proc/<pid>/cmdline` heuristics when available
- If the process disappears unexpectedly, stale files are cleaned up on the next status/stop
- Configuration (port/host/log level) is resolved before daemonizing; adjust via `pokecode serve ...`

