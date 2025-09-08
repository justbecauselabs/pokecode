# Operations Runbook

Operational guidance for running `@pokecode/server` in development or on a single host.

## Prerequisites

- Bun installed
- `~/.pokecode/config.json` present with a valid `claudeCodePath` (use `pokecode setup`)

## Start

- TUI (recommended): `pokecode serve`
- Direct server (stdout logs): `bun run dev:server`
- Logs (file): `pokecode logs -f`

## Health

- HTTP: `GET /health`
  - Shows version and service statuses (`database`, `queue`)
- Quick check:
  - `curl http://localhost:3001/health | jq`

## Sessions & Messages

- Create session: `POST /api/sessions` (see API schemas in `@pokecode/api`)
- Stream messages: `GET /api/sessions/:sessionId/messages/stream`
- List messages (cursor): `GET /api/sessions/:sessionId/messages?after=<id>&limit=<n>`
- Enqueue prompt: `POST /api/sessions/:sessionId/messages` (body: `{ content, model? }`)
- Cancel: `POST /api/sessions/:sessionId/cancel`

## Worker

- Auto‑started by the CLI after the server begins listening
- Concurrency and polling: configured in `~/.pokecode/config.json` (see core config reference)
- Cleanup: runs hourly to delete old completed/failed jobs beyond retention

## Logs

- Location: `~/.pokecode/pokecode.log`
- View last lines: `pokecode logs -n 200`
- Follow: `pokecode logs -f`

## Common Issues

- Missing `claudeCodePath`:
  - Run `pokecode setup` or edit `~/.pokecode/config.json`
- Port in use:
  - Start on a different port: `pokecode serve --port 3002`
- Stuck session / need to stop work:
  - `POST /api/sessions/:sessionId/cancel`
- Long‑running jobs:
  - Lower `workerConcurrency` or raise it to parallelize; adjust based on CPU/IO
- Empty SSE stream:
  - Ensure the session exists and your EventSource URL matches the session ID

## Safety

- Job queue is SQLite‑backed; avoid running multiple separate server+worker stacks against the same DB file unless you fully understand the concurrency trade‑offs.
- CLI log redaction minimizes sensitive fields in request logging, but audit before exposing to the internet; there is no auth built‑in.
