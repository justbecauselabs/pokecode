# Claude Code Messages in Core

This document explains how PokéCode ingests, stores, parses, and streams Claude Code messages.

## Goals

- Preserve the full fidelity of Claude SDK messages for auditing and recovery
- Provide a stable, typed API `Message` structure for clients
- Support session resumption, cancellation, and token accounting

## Ingestion Path

- Runner: `src/services/claude-code-sdk.service.ts`
  - Calls Anthropic’s Claude Code SDK and iterates the async stream
  - For each `SDKMessage`, calls `messageService.saveSDKMessage(...)`
  - Tracks Claude SDK `session_id` for resumption
  - Uses an `AbortController` to support cancellation mid‑stream

## Storage Model

- Table: `session_messages`
  - `type`: `'user' | 'assistant' | 'system' | 'result' | 'error'`
  - `content_data`: JSON string of the raw `SDKMessage`
  - `claude_code_session_id`: the Claude SDK session id used for resume
  - `token_count`: extracted sum of input+output tokens when available
- Helper: `extractTokenCount(...)` in `src/utils/claude-code-message-parser.ts`
- Session counters updated transactionally in `message.service.ts`:
  - `messageCount` and `tokenCount` on the parent `sessions` row

## Parsing to API Messages

- Function: `parseDbMessage(dbMessage, projectPath?)`
  - Input: a row from `session_messages`
  - Output: typed `@pokecode/api` `Message`
- Strategy:
  - User messages with text → `{ type: 'user', data: { content } }`
  - Assistant messages map tool uses into a discriminated union:
    - `todo`, `read`, `bash`, `edit`, `multiedit`, `task`, `grep`, `glob`, `ls`
    - Also supports tool results via `type: 'tool_result'`
  - System messages (e.g., cancellation) → assistant text message for clarity
  - Best‑effort fallback to text content when blocks don’t match a known tool pattern
- Path handling:
  - For tools that include paths, absolute paths under the project root are made relative when `projectPath` is provided.

## Real‑time Streaming

- On successful insert, `message.service.ts` emits an SSE update via `event-bus.service.ts`:
  - `emitNewMessage(sessionId, message)` with `{ type: 'update', data: { state: 'running', message } }`
  - When a job completes or is cancelled: `emitSessionDone(sessionId)` emits `{ state: 'done' }`

## Session Resumption

- `messageService.getLastClaudeCodeSessionId(sessionId)` finds the latest stored `claude_code_session_id`
- `ClaudeCodeSDKService.execute(...)` passes `resume` to the SDK when available, so Claude continues the same session thread

## Cancellation

- Server triggers `messageService.cancelSession(sessionId)` which:
  - Marks queued and processing jobs as `cancelled`
  - Updates session working state and emits `done`
- Workers detect cancellation periodically and call `ClaudeCodeSDKService.abort()`
- A friendly cancellation message is inserted so clients see immediate feedback

## Types and Validation

- Strict message shapes for tooling live in `src/types/claude-messages.ts` (Zod)
- Public API message types are defined in `@pokecode/api` schemas

## Key Files

- `src/services/claude-code-sdk.service.ts`
- `src/services/message.service.ts`
- `src/utils/claude-code-message-parser.ts`
- `src/types/claude-messages.ts`
- `src/database/schema-sqlite/session_messages.ts`
