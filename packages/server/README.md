# @pokecode/server

Fastify HTTP API with SSE streaming plus a lightweight worker that executes Claude Code prompts via a SQLite-backed job queue.

## What’s Inside

- Fastify app with Zod type provider and plugins
  - Routes: health, repositories, directories, sessions (+ messages, agents, commands)
  - SSE: `fastify-sse-v2` stream for real‑time updates per session
  - Plugins: request logger (sanitized), centralized error handler
- Worker: `src/workers/claude-code-sqlite.worker.ts`
  - Polls the SQLite queue and runs Claude Code SDK
  - Handles cancellation, retries, cleanup, and metrics

## Run (Bun)

- TUI via CLI: `pokecode serve`
- Direct dev server (stdout logs, runs worker + migrations): `bun run start`
- Build: `bun run build`
- Typecheck: `bun run typecheck`

Server reads config from `~/.pokecode/config.json` (Bun auto‑loads `.env` if present). Ensure `claudeCodePath` is set.

## Key Endpoints (prefixes)

- `GET /health` — liveness and dependency checks
- `GET /api/claude-code/repositories` and `/directories`
- `GET /api/claude-code/sessions` — session CRUD and nested routes
  - `GET /:sessionId/messages` — cursor pagination
  - `GET /:sessionId/messages/raw` — raw SDK messages
  - `GET /:sessionId/messages/stream` — SSE stream
  - `POST /:sessionId/messages` — enqueue prompt; returns 202
  - `POST /:sessionId/cancel` — cancel in‑flight work

## Worker Lifecycle (high‑level)

1) `POST /messages` saves a user message and enqueues a job in SQLite
2) Worker polls for `pending` jobs (respecting concurrency), marks `processing`
3) Runs Claude Code SDK; each streamed message is saved and emitted via SSE
4) On success: job → `completed`, session → `done`
5) On error: exponential backoff until `maxJobAttempts`, then `failed`
6) On cancel: job(s) → `cancelled`, SDK aborted, session → `done`

## Docs

- Message queuing & workers: docs/message-queue.md
- Operations runbook: docs/runbook.md
- API routes reference: docs/api-routes.md
