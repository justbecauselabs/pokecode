# Message Queuing & Workers (Server)

This document describes how the server enqueues, processes, and cancels Claude Code prompts using a SQLite-backed job queue implemented in `@pokecode/core`.

## Components

- Queue storage: `core/src/database/schema-sqlite/job_queue.ts`
- Queue API: `core/src/services/queue-sqlite.service.ts`
- Worker: `server/src/workers/claude-code-sqlite.worker.ts`
- Sessions + messages routes: `server/src/sessions/*.ts`
- SDK runner: `core/src/services/claude-code-sdk.service.ts`

## Enqueue Flow

- Endpoint: `POST /api/claude-code/sessions/:sessionId/messages`
  1) Validates session, saves a user message (for immediate UI echo)
  2) Calls `messageService.queuePrompt(...)` → `sqliteQueueService.addPromptJob(...)`
  3) Sets session `isWorking = true`, `currentJobId = promptId`
  4) Replies 202; client listens on SSE stream

Job payload includes: `prompt`, `projectPath`, optional `allowedTools`, optional `model`.

## Worker Processing

- Class: `ClaudeCodeSQLiteWorker`
- Startup: polls every `workerPollingInterval` ms; processes up to `workerConcurrency` jobs concurrently
- Lifecycle per job:
  1) `getNextJob()` selects the oldest `pending` job (respecting `nextRetryAt`)
  2) `markJobProcessing(jobId)` and set session state (`isWorking`, `lastJobStatus`)
  3) Instantiate `ClaudeCodeSDKService` and call `execute(prompt)`
  4) Streamed SDK messages are saved directly to DB by the SDK service; SSE updates are emitted
  5) On success: `markJobCompleted(jobId)`, session marked `done`, `emitSessionDone()`
  6) On failure: `markJobFailed(jobId, error)` with exponential backoff (2^attempts * 2000ms)

## Cancellation

- Endpoint: `POST /api/claude-code/sessions/:sessionId/cancel`
  - Calls `messageService.cancelSession(sessionId)`
  - Queue side: all `pending`/`processing` jobs for the session are marked `cancelled`
  - Worker side: a periodic checker detects cancellation and calls `ClaudeCodeSDKService.abort()`
  - A cancellation message is inserted so clients get visible feedback

## Cleanup & Retention

- `sqliteQueueService.cleanup()` deletes completed/failed jobs older than `jobRetention` days
- The worker schedules cleanup hourly

## Observability

- SSE stream per session: `GET /api/claude-code/sessions/:sessionId/messages/stream`
- Session fields updated throughout: `isWorking`, `currentJobId`, `lastJobStatus`, counters
- Queue metrics helper: `sqliteQueueService.getQueueMetrics()` (waiting/active/completed/failed)

## Configuration (from `~/.pokecode/config.json`)

- `workerConcurrency` — max simultaneous jobs (default 5)
- `workerPollingInterval` — ms between polls (default 1000)
- `jobRetention` — days to keep completed/failed jobs (default 30)
- `maxJobAttempts` — retry attempts per job (default 1)
- `claudeCodePath` — required path to the Claude Code executable

## Sequence (text)

- Client → POST message → 202
- Server → enqueue SQLite job; SSE ‘running’ begins
- Worker → mark processing → run SDK → messages saved → SSE ‘update’s
- Success → job completed → `emitSessionDone`
- Error → retry/backoff or `failed` → `emitSessionDone`
- Cancel → mark jobs cancelled → SDK abort → insert cancellation message → `emitSessionDone`

