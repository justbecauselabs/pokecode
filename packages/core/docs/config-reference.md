# Config Reference

Centralized configuration for server, worker, paths, and logging. Loaded via `getConfig()` in `src/config/index.ts`.

## Resolution Order

1) Defaults (hardcoded)
2) `~/.pokecode/config.json` (strictly validated subset)
3) In‑process overrides via `overrideConfig({...})` (used by CLI `serve`)

Bun auto‑loads `.env`, but config currently does not read individual env vars, except `NODE_ENV` which affects the default DB path (see below).

## Fields and Defaults

- `port` (number): 3001
- `host` (string): `0.0.0.0`
- `logLevel` ("fatal" | "error" | "warn" | "info" | "debug" | "trace"): `info`
- `databasePath` (string): `~/.pokecode/pokecode.db` or `:memory:` when `NODE_ENV=test`
- `databaseWAL` (boolean): `true`
- `databaseCacheSize` (number): `1000000` (1GB)
- `configDir` (string): `~/.pokecode`
- `claudeCodePath` (string | undefined): path to Claude Code executable (required for running prompts)
- `repositories` (string[]): list of project roots the server can expose
- `configFile` (string): `~/.pokecode/config.json`
- `logFile` (string): `~/.pokecode/pokecode.log`
- `pidFile` (string): deprecated
- `daemonFile` (string): deprecated
- Worker
  - `workerConcurrency` (number): 5
  - `workerPollingInterval` (ms): 1000
  - `jobRetention` (days): 30
  - `maxJobAttempts` (number): 1

## File Config Schema

The file at `~/.pokecode/config.json` is validated and may include only:

```json
{
  "repositories": ["/path/to/project1", "/path/to/project2"],
  "claudeCodePath": "/absolute/path/to/node_modules/@anthropic-ai/claude-code/cli.js"
}
```

Other fields can be overridden at runtime by the CLI `serve` command flags.

## Overrides via CLI

- `pokecode serve --port <n> --host <h> --log-level <level>` → applied via `overrideConfig()` before server/worker start.

## Where It’s Used

- Server binding (`createServer`) reads `port`, `host`, `logLevel`.
- Worker (`ClaudeCodeSQLiteWorker`) reads concurrency, polling, and retention settings.
- DB init (`src/database/index.ts`) reads `databasePath` and enables WAL/PRAGMA.
- Log file path affects `pokecode logs`. PID/daemon files are deprecated.
