# @pokecode/core

Core domain logic shared by the server and CLI. It provides database access, typed services, message parsing for Claude Code, a lightweight SQLite job queue, configuration, and a small event bus for real‑time updates.

## What’s Inside

- Database: `bun:sqlite` via Drizzle ORM, migrations, and typed tables
  - Tables: `sessions`, `session_messages`, `job_queue`
  - Entry: `src/database/index.ts`
- Services: cohesive units of behavior
  - `session.service.ts` — CRUD and derived session state
  - `message.service.ts` — save/query messages, cursor pagination, SSE emission
  - `claude-code-sdk.service.ts` — runs Claude Code SDK and streams messages into DB
  - `queue-sqlite.service.ts` — simple SQLite-backed job queue APIs
  - `event-bus.service.ts` — typed EventEmitter powering SSE updates
  - `repository.service.ts`, `command.service.ts`, `agent.service.ts`
- Message parsing: `src/utils/message-parser.ts` maps raw SDK messages to API `Message`
- Types & schemas: `src/types/*` (e.g., `claude-messages.ts`)
- Config: `src/config/index.ts` (single source of truth for ports, paths, worker settings)
- Tests: `packages/core/tests/*`

## Quick Start (Bun)

- Build: `bun run build`
- Typecheck: `bun run typecheck`
- Dev (watch): `bun run dev`

Bun automatically loads `.env`. Most runtime options live in `~/.pokecode/config.json` (see below).

## Configuration

- Config file: `~/.pokecode/config.json`
- Required for Claude integration: `claudeCodePath` (path to the Claude Code executable)
- Worker settings (used by server workers): `workerConcurrency`, `workerPollingInterval`, `jobRetention`, `maxJobAttempts`

See `src/config/index.ts` for defaults and resolution order (file → overrides).

## Data Flow Overview

1) A user prompt is saved as a user message and a prompt job is added to `job_queue`.
2) A server worker runs `ClaudeCodeSDKService` which streams SDK messages.
3) Each SDK message is stored in `session_messages.content_data` as JSON and immediately emitted via the event bus as SSE updates.
4) Sessions track `isWorking`, `currentJobId`, `lastJobStatus`, `messageCount`, and `tokenCount`.

## Deep Dives

- Claude Code messages: docs/claude-code-messages.md
- Database schema: docs/database-schema.md
- Config reference: docs/config-reference.md
