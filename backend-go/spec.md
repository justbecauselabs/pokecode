# Claude Code Mobile — Go Backend (Demo)

This document captures the current implementation in `backend-go/`, the intended architecture, and a detailed, prioritized TODO list to reach feature parity with the existing TypeScript backend while embracing Go conventions.

---

## 1) High‑Level Goals

- Provide a fast, strongly‑typed, operationally simple backend in Go.
- Mirror existing API behavior and data shapes wherever practical to ease client integration.
- Safely access Claude Code local storage (~/.claude) and integrate with the Claude Code CLI/SDK flow via a dedicated worker.
- Use Redis for both queuing (Asynq) and pub/sub streaming of prompt events.
- Maintain security hardening and strong validation throughout I/O boundaries.

---

## 2) Current Architecture (Demo Scope)

Components implemented:

- API server (Gin):
  - Health endpoints: `/health`, `/live`, `/ready` (now check Redis and Postgres)
  - Sessions endpoints (minimal CRUD): `/api/claude-code/sessions` (POST, GET, GET by id, PATCH, DELETE)
  - Prompt enqueue endpoint (demo): `/api/claude-code/sessions/:sessionId/prompts` (POST)
- Queue (Asynq): Redis‑backed, `claude:prompt` task type.
- Worker (Asynq server): handles `claude:prompt` by running a "Claude runner" and streaming events to Redis pub/sub channel `claude-code:<sessionId>:<promptId>`.
- Claude runner (demo):
  - If `CLAUDE_CODE_PATH` is unset: simulate a short event stream (message_start, text_delta, tool_use, tool_result, etc.).
  - If set: shell out to Node/CLI (stub wiring in place) and stream stdout JSONL (strict decoding to be added).
- Postgres integration (pgxpool):
  - Migrations: sessions table (`claude_code_sessions`) and `session_messages` table.
  - Simple repository for sessions (create, get, list, update, delete), with `claude_directory_path` derived like the TS version.
- Env + preflight:
  - `.env` loaded for both API and worker.
  - API logs address, Redis, DB (masked), Claude path, repos dir; worker logs Redis, log level.
- Makefile tooling:
  - Run API/worker in background (`api-bg`, `worker-bg`) and show first log lines.
  - `migrate` (simple in‑house runner), `seed`, `stop`, `tidy`.

Notable constraints (demo):

- No JSONL parsing yet (strict Zod‑like unions pending); no thread grouping logic; no SQLite reads.
- No WebSocket fanout; pub/sub is available for consumers.
- No authentication or rate limiting middleware yet.

---

## 3) Repository Layout

```
backend-go/
  cmd/
    api/        # API server main
    worker/     # Worker main
    migrate/    # Minimal migration runner
    seed/       # Demo seeding
  internal/
    claude/     # Runner + dir path helpers (JSONL parsing TBD)
    config/     # Env + DSN builders + masking
    db/         # pgxpool wrapper
    http/       # Gin routes (health, sessions, prompts)
    logz/       # Zerolog setup
    migrate/    # File-based migration runner (simple)
    queue/      # Asynq client/server + payloads
    repo/       # Session repository (pgx)
  sql/
    migrations/ # 0001_init.up.sql
  .env, .env.example, .env.test
  Makefile
  README.md
  spec.md (this file)
```

---

## 4) Dependencies

- HTTP: `github.com/gin-gonic/gin` + `github.com/gin-contrib/cors`
- Config: `github.com/joho/godotenv`, `github.com/caarlos0/env/v11`
- Logging: `github.com/rs/zerolog`
- Redis/Queue: `github.com/hibiken/asynq`, `github.com/redis/go-redis/v9`
- Postgres: `github.com/jackc/pgx/v5`
- Utils: `github.com/google/uuid`

---

## 5) Environment & Configuration

- `.env` mirrors the TS backend values and is loaded automatically.
- Important variables:
  - `PORT`, `LOG_LEVEL`
  - `REDIS_URL` (e.g., `redis://localhost:6379`)
  - `CLAUDE_CODE_PATH` (optional in demo; if unset, we simulate)
  - `GITHUB_REPOS_DIRECTORY` (used for resolving `folderName` -> absolute path)
  - `DATABASE_URL` or `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- API preflight logs a masked DB DSN.

---

## 6) Database Schema (Parity with TS)

- `claude_code_sessions`:
  - `id UUID PK`
  - `project_path TEXT NOT NULL`
  - `context TEXT`
  - `status session_status DEFAULT 'active' NOT NULL`
  - `claude_directory_path TEXT`
  - `claude_code_session_id TEXT`
  - `metadata JSONB`
  - Timestamps: `created_at`, `updated_at`, `last_accessed_at`
  - Working fields: `is_working BOOL`, `current_job_id TEXT`, `last_job_status TEXT`
  - Indexes: `status`, `last_accessed_at`, `is_working`
- `session_messages`:
  - `id UUID PK`
  - `session_id UUID REFERENCES claude_code_sessions(id) ON DELETE CASCADE`
  - `text TEXT NOT NULL`
  - `type message_type NOT NULL` (`user`|`assistant`)
  - `claude_session_id TEXT`
  - `created_at TIMESTAMPTZ`
  - Indexes: `session_id`, `type`, `created_at`, `claude_session_id`

Migration source: `sql/migrations/0001_init.up.sql`.

---

## 7) Running & Verifying

- Migrate DB:
  - `cd backend-go && make migrate`
- Background processes:
  - Start worker: `make worker-bg` → writes `worker.log`, PID to `worker.pid`
  - Start server: `make api-bg` → writes `server.log`, PID to `api.pid`
  - Stop both: `make stop`
- Check logs:
  - `tail -n 50 backend-go/server.log`
  - `tail -n 50 backend-go/worker.log`
- Health:
  - `curl -s http://localhost:3001/health | jq`
- Create session:
  - `curl -s -X POST -H 'Content-Type: application/json' -d '{"folderName":"demo"}' http://localhost:3001/api/claude-code/sessions | jq`
- Enqueue prompt:
  - `curl -s -X POST -H 'Content-Type: application/json' -d '{"prompt":"List files"}' http://localhost:3001/api/claude-code/sessions/<SESSION_ID>/prompts | jq`
- Observe worker log for simulated streaming; pub/sub channel: `claude-code:<sessionId>:<promptId>`.

---

## 8) HTTP API (Implemented)

- `GET /health` → { status, services: { redis, database }, version, uptime }
- `GET /live` → { status: ok }
- `GET /ready` → { status: ready }
- `POST /api/claude-code/sessions`
  - Body: `{ projectPath?: string, folderName?: string, context?: string, metadata?: object }`
  - Validates exactly one of `projectPath` or `folderName`.
  - Returns session with `claudeDirectoryPath` computed like TS backend.
- `GET /api/claude-code/sessions` (query: `status?`, `limit?`, `offset?`)
  - Lists sessions with `claude_code_session_id IS NOT NULL` filter (parity with TS list behavior).
- `GET /api/claude-code/sessions/:sessionId`
- `PATCH /api/claude-code/sessions/:sessionId`
- `DELETE /api/claude-code/sessions/:sessionId`
- `POST /api/claude-code/sessions/:sessionId/prompts`
  - Body: `{ prompt: string, projectPath?: string }`
  - Enqueues `claude:prompt` task. Worker streams events to Redis pub/sub.

---

## 9) Queue/Worker & Streaming

- Queue type: `claude:prompt` with payload `{ sessionId, promptId, prompt, projectPath, messageId }`.
- Worker:
  - Publishes a start message to Redis pub/sub channel: `claude-code:<sessionId>:<promptId>`.
  - Runs Claude runner (simulate if `CLAUDE_CODE_PATH` unset).
  - Publishes event stream (`message_*`, `content_block_*`, `tool_use`, `tool_result`, `result`, `error`).
  - On failure, publishes an `error` event and returns `SkipRetry` (configurable later).

---

## 10) Logging & Observability

- Zerolog JSON logs on stdout; `api-bg` and `worker-bg` redirect to `server.log` and `worker.log`.
- API preflight summary includes masked DB DSN and CLAUDE path.
- Health probes reflect Redis + DB.
- TODO: add Prometheus metrics, request IDs, structured queue metrics.

---

## 11) Security Notes (Current + Planned)

- Path computation for Claude directory mirrors TS code (replace `/` and `_`), but needs:
  - Strict normalization, symlink resolution, and base dir allowlist for any FS access.
- API body validation uses Gin binding; TODO to add `go-playground/validator` rules.
- Rate limiting and CORS are basic; TODO to add Redis‑backed limiter middleware and tighter CORS in prod.
- No auth yet; TODO JWT or service tokens consistent with TS backend.

---

## 12) Testing Strategy

- Unit tests for:
  - Claude directory path derivation
  - Migration runner dry‑run
  - Session repository (DB against test container)
  - Runner simulation events
- Integration tests:
  - API e2e (create session → enqueue prompt → observe pub/sub stream)
  - Background process lifecycle (graceful stop, no file descriptor leaks)

---

## 13) Roadmap / TODOs (Prioritized)

P0 — Core Parity + Safety
- [ ] Claude CLI integration: real subprocess execution when `CLAUDE_CODE_PATH` is set (arguments/env, working dir), capture stderr and exit codes robustly.
- [ ] Strict JSONL streaming decode (stdout):
  - [ ] Define precise Go structs (discriminated unions) for `assistant`, `user`, `system`, `result`, `thinking`, `tool_use`, `tool_result`, `citations_delta`, etc.
  - [ ] Use `json.Decoder` with `DisallowUnknownFields()` and typed switching; emit meaningful parse errors.
  - [ ] Size guards and string truncation similar to TS worker.
- [ ] JSONL history reading (filesystem):
  - [ ] Enumerate `~/.claude/projects/<projectKey>[/<sessionId>]/*.jsonl` with safe path checks and symlink handling.
  - [ ] Strict per‑line decode into validated types.
  - [ ] Thread grouping and final response extraction to match TS `ClaudeDirectoryService` logic.
- [ ] Persist and enrich messages:
  - [ ] Create DB rows for user message on prompt creation, and assistant message on completion.
  - [ ] Backfill `claude_code_session_id` on first captured message with `session_id`.
  - [ ] `GET messages` endpoint with DB + JSONL enrichment parity.
- [ ] Session working state in DB: set `is_working`, `current_job_id`, `last_job_status` on enqueue/start/success/failure.
- [ ] Rate limiting (Redis store) for prompt POST and polling endpoints.
- [ ] WebSocket gateway (optional) or server‑sent events to forward Redis pub/sub to clients.

P1 — Robustness + DX
- [ ] Asynq retry/backoff tuning; idempotency keys for tasks.
- [ ] Prompt cancellation: track running CLI process; kill on DELETE `/prompts/:id`.
- [ ] Graceful shutdown: ensure runner interrupt/kill and pub/sub finalization.
- [ ] Structured metrics with Prometheus: HTTP, queue, worker, runner timings.
- [ ] Replace simple migration runner with `golang-migrate` or keep simple runner but add down migrations and checksums audit.
- [ ] Config validation and richer preflight (existence checks for repos dir, CLAUDE path executable, DB/Redis reachability with timeouts).
- [ ] Add per‑request logging with request IDs.

P2 — Ops + Quality
- [ ] Dockerfiles for API and worker; multi‑stage builds.
- [ ] Compose file with Postgres + Redis for local dev.
- [ ] CI: lint (`go vet`, `staticcheck`), build, test, integration tests with ephemeral services.
- [ ] Load/perf tests for queue and streaming.
- [ ] Documentation: OpenAPI generation (swag) or typed contracts.
- [ ] Feature flags to toggle simulator vs real CLI.

Stretch / Future
- [ ] SQLite read‑path in addition to JSONL (read‑only), if we decide to mirror all TS capabilities.
- [ ] Pluggable storage for history (optional S3/archive export).

---

## 14) Implementation Notes & Decisions

- Asynq chosen for Redis‑backed jobs to parallel BullMQ nicely; simple to operate and good visibility.
- pgxpool provides solid typed access; `sqlc` can be added later to generate typed queries (currently we hand‑wrote minimal repo functions).
- Custom migration runner keeps the demo self‑contained; we can swap to `golang-migrate` with a small wrapper.
- Runner simulates events while we verify the full end‑to‑end flow (enqueue → stream → observe logs). This keeps early feedback loops fast.

---

## 15) Open Questions

- Do we want 1:1 response shapes for all endpoints or Go‑idiomatic structs with a compatibility translator layer?
- Should the worker be a separate binary/container (recommended) with a separate config and lifecycle?
- Where should we host metrics and how do we integrate with existing dashboards?

---

## 16) Quick Command Reference

- One‑time setup:
  - `make migrate`
- Start background services:
  - `make worker-bg`
  - `make api-bg`
- Tail logs:
  - `tail -n 50 worker.log`
  - `tail -n 50 server.log`
- Stop services:
  - `make stop`
- Seed demo session:
  - `make seed`

---

## 17) Change Log (What’s Implemented So Far)

- Created Go module with Gin API, Asynq worker, pgx Postgres, Redis client, Zerolog, dotenv/env.
- Added `.env` parity with Node backend and preflight logging (masked DB DSN).
- Implemented minimal migrations for sessions and session_messages tables.
- Implemented Sessions CRUD and prompt enqueue route.
- Implemented worker that publishes streaming events (simulated) to Redis pub/sub.
- Added Makefile targets to run API/worker in background and tail logs.
- Added seed command and simple migration runner.

---

## 18) Next Steps Snapshot

- P0: Real CLI integration; strict JSONL streaming decode; JSONL history/threading; DB message persistence; working state updates; rate limiting; optional WebSocket/SSE bridge.
- P1: Cancellation, retries/backoff, metrics, better migrations, config validation, request‑ID logging.
- P2: Docker/compose, CI/test suites, OpenAPI, feature flags.

---

_End of spec._
