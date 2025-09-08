# PokéCode CLI TUI — Product & Technical Spec

Owner: CLI team  • Target: packages/cli  • Trigger: `pokecode serve`

## Goals

- Full-screen TUI when running `pokecode serve` in a TTY.
- Single glance overview: connected devices, active sessions (last hour), server/worker health, config status, and live logs.
- Zero config; respects existing server/daemon behavior. Works with Bun. Strict TypeScript; no `any`/assertions.

## Non‑Goals

- Replacing the Fastify server with `Bun.serve()` (future option). 
- Building a remote, multi-host dashboard.

## Launch & Modes

- Foreground: `pokecode serve` starts server and takes over terminal with the TUI.
- Daemon: `pokecode serve --daemon` starts server in background (no TUI). Attach with `pokecode dashboard` (new) or `pokecode serve --attach`.
- Non‑TTY: fall back to plain logs/URLs (current behavior).

## UX Overview

Terminal takeover layout (80x24+). Resizable, mouse optional.

```
┌──────────────────────────── Header: PokéCode @ http://HOST:PORT ───────────────┐
│ Server: Healthy  DB: Healthy  Queue: Healthy  Worker: Running  Uptime: 1h23m   │
│ Config: ClaudeCode[✓]  CodexCLI[✗]  LogLevel: info  RepoCount: 3              │
├──────────────────────── Left: Connected Devices (last 1h) ─────────────────────┤
│ id       name           platform  version   last seen   status                  │
│ a1b2c3d4 Billy iPhone   ios       1.2.3     2m ago     active                  │
│ …                                                                               │
├──────────────────────── Right Top: Active Sessions (last 1h) ──────────────────┤
│ id   name           provider  state  working  updated   msgs  tokens            │
│ …                                                                               │
├───────────────────────────── Right Bottom: Live Logs ──────────────────────────┤
│ 12:01:33 http  GET /api/sessions 200 (15ms)                                     │
│ …                                                                               │
└────────────────────────────────── Footer / Help ───────────────────────────────┘
  q Quit  r Restart worker  s Toggle logs  f Filter  ←/→ Focus  ↑/↓ Select  p Pause
```

### Panels

- Header: endpoint, health summary, uptime, config summary, log level.
- Devices: list of devices with heartbeat in last 3600s (sorted by lastConnectedAt desc).
- Sessions: list of sessions updated in last 3600s (sorted by updatedAt desc).
- Logs: not rendered in TUI; users follow the log file via `pokecode logs -f`.
- Footer: keyboard cheatsheet and transient status messages.

### Keyboard & Mouse

- q: quit (graceful server shutdown in foreground mode; detach in attach mode).
- r: restart worker (POST `/api/worker/restart`).
- ←/→: move focus between panes; ↑/↓/PgUp/PgDn: navigate; Enter: open details view (modal) for selected item.
- Mouse: click to focus; scroll in lists.

## Data Sources

Existing endpoints used as‑is:

- GET `/health` → server/db/queue health summary.
- GET `/api/sessions?state=active&limit=20` → client will filter `updatedAt >= now-3600s`.

New APIs to add (server + api packages):

- GET `/api/connect/devices` — list known devices with optional freshness filter.
  - Query: `activeWithinSeconds` (default 3600), `limit` (default 100), `offset`.
  - Response item: `{ deviceId, deviceName, platform, appVersion, lastConnectedAt }`.

- GET `/health/config` — config paths + existence and versions.
  - Response: 
    - `claudeCode: { configuredPath: string | null, exists: boolean, version: string | null }`
    - `codexCli: { configuredPath: string | null, exists: boolean, version: string | null }`
  - Implementation: use `Bun.file(path).exists()`; versions via `Bun.$` with `--version` (timeout 2s).

- GET `/api/queue/metrics` — surface `sqliteQueueService.getQueueMetrics()`.

- POST `/api/worker/restart` — instruct `AgentRunnerWorker` to shutdown + start; returns `{ status: 'ok' }`.

Open to implement later (nice‑to‑have):

- GET `/api/sessions/active?sinceSeconds=3600` shortcut (server filters in SQL).

## TUI Technical Design

### Runtime & Libraries

- Runtime: Bun. All CLI code runs with `bun`.
- TUI: minimal ANSI renderer using Chalk and raw stdin for keys (no React/Ink).
- HTTP: native `fetch` for polling.
- Strict TypeScript: use zod schemas from `@pokecode/api` to parse responses on the client; infer types with `z.infer`.

### Version Pinning

- Keep dependencies minimal; commit `bun.lockb` to lock transitive deps.

### Process Model

- Foreground mode: one process hosts both Fastify server and the TUI. The TUI polls HTTP endpoints for data.
- Attach mode: TUI runs as a pure client against an already running server.
- Daemon mode: No TUI; users attach with `pokecode dashboard`.

### In‑Process Event Bridge (foreground)

- Not used for logs; logs are file-only. May add for other events later if needed.

### State Model (client)

- Root state: `{ focus: 'devices' | 'sessions', health, config, devices[], sessions[], queueMetrics }`.
- Refresh cadences:
  - Health/config/metrics: every 5s.
  - Devices: every 5s (with `activeWithinSeconds=3600`).
  - Sessions: every 10s (client filters by last hour).

### Error Handling

- Surface transient errors non‑blocking in footer.
- Retrying with exponential backoff per data source; pause retries if offline.
- Respect `NO_COLOR` and `FORCE_COLOR` env vars.

### Accessibility & Theming

- High‑contrast theme; no red/green only cues.
- Minimal color palette with fallback to monochrome; allow `--theme=dark|light|mono`.

## CLI Surface Changes

- `pokecode serve [--daemon] [--attach]` — default: TUI in foreground; `--attach` connects to running server.
- `pokecode dashboard` — alias for `serve --attach`.
- `pokecode logs -f` — remains; useful for non‑TTY pipelines.

## Server Changes (summary)

- packages/server
  - Add `GET /api/connect/devices` route (uses `deviceService`, new read method).
  - Add `GET /health/config` route (reads `getConfig()`, checks paths with `Bun.file`, runs `Bun.$` `--version`).
  - Add `GET /api/queue/metrics` route (returns `sqliteQueueService.getQueueMetrics()`).
  - Add `POST /api/worker/restart` wiring to `AgentRunnerWorker`.

- packages/api
  - Add zod schemas/types: `Device`, `ListDevicesQuery`, `ListDevicesResponse`, `ConfigStatus`, `QueueMetrics`.

## Implementation Plan (incremental)

1) API types & routes
   - Add device/config/queue/logs endpoints and schemas.
2) TUI bootstrap (ANSI)
   - Implement ANSI TUI renderer in `packages/cli/src/tui/` (no React/Ink): draws header/devices/sessions/queue and footer.
   - Poll endpoints on intervals; redraw with minimal flicker.
   - Wire `serve.ts` to detect TTY and mount TUI in foreground; `--attach` launches TUI-only client.
3) Logs
   - No TUI log stream. All logs are written to `~/.pokecode/pokecode.log`; users view via `pokecode logs -f`.
4) Worker controls
   - Implement `POST /api/worker/restart`; bind to `r` key.
5) Polish
   - Filters, pause, persist last focused pane, theme.
6) Tests (bun test)
   - Snapshot tests for ANSI draw function; HTTP mock for health/devices/sessions.

## TypeScript & Bun Standards

- Use the existing repo `tsconfig.json` strictness; do not introduce `any`/`unknown`/type assertions.
- Validate all network responses with zod; use inferred types (`z.infer<...>`).
- Rely on `Bun.file(path).exists()` for file checks and `Bun.$` for subprocess version checks.
- No `dotenv`; Bun auto‑loads `.env`.
- No React. Keep strict types for TUI renderer functions and HTTP clients; avoid `as` assertions.

## Telemetry & Privacy

- Do not transmit data externally. All calls remain local to the configured server.
- Avoid logging secrets; continue using sanitized request logger.

## Open Questions

- Should `serve --daemon` auto‑launch an attaching dashboard? Current daemon implementation exits immediately; attaching would require a follow‑up process.
- Do we need a “session details” modal with message tail and job list? (proposed, later)
- Minimum terminal size to render all panes? If too small, collapse logs by default.

## Acceptance Criteria

- `pokecode serve` in a TTY renders the TUI and updates at the cadences above.
- Devices panel shows entries with `lastConnectedAt` in the last 3600s.
- Sessions panel lists sessions with `updatedAt` within the last 3600s.
- Header shows health and config status; toggles color by healthy/unhealthy and exists/missing.
- Logs stream in real time; can be paused and filtered.
- Quitting in foreground stops server gracefully (existing signal handlers), attach mode only closes the TUI.
