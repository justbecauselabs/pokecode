# Codex CLI Integration Spec (PokéCode)

Status: Draft (v0.3)
Owners: Core/Server/CLI
Last updated: 2025-09-03

## Progress
- [x] Add `codexCliPath` to core config (2025-09-03)
- [x] API: introduce Provider enum/schema and export (2025-09-03)
- [x] API: require `provider` in CreateSessionRequest; add `provider` to Session schema (2025-09-03)
- [x] Core DB: created provider enum values in schema; renamed table to `sessions`; added `provider` to sessions, session_messages, job_queue; updated migration (2025-09-03)
- [x] Types package: introduced `@pokecode/types` with `PROVIDER_VALUES` + `ProviderSchema`; updated core and api to depend on it (2025-09-03)
- [x] Core: add AgentRunner interfaces file (packages/core/src/services/agent-runner.ts)
- [ ] Server: switch to session-scoped routes and infer provider by `sessionId`
- [ ] Worker: implement `AgentSQLiteWorker` dispatching by job.provider
- [ ] CodexRunner: spawn CLI and persist raw JSONL (parsing TODO)
- [ ] CLI: setup prompts/validates `codexCliPath`; print in status/startup
- [ ] Mobile: model picker remains for Claude; Codex uses fixed model

Milestone 1 complete — API provider types + CreateSession provider. Stopping here for review before proceeding to server/core wiring.

## Goals
- Support Codex CLI as a first-class coding agent alongside Claude Code.
- Keep mobile and API clients stable while we add the new provider.
- Maintain strict typing across boundaries (no `any`, no type assertions).
- Preserve existing data and flows; allow safe rollback.

## Non‑Goals
- Replace Claude Code or remove existing endpoints in the first phase.
- Change the external SSE message shape consumed by clients.

---

## Current Architecture (summary)
- A SQLite-backed queue drives a worker (`ClaudeCodeSQLiteWorker`) that runs `ClaudeCodeSDKService`.
- Raw SDK messages are stored in `session_messages.content_data` (JSON) and normalized to `Message` via `message-parser`.
- Routes are under `/api/claude-code/...`; mobile subscribes to SSE and paginates via REST.
- DB tables: `claude_code_sessions`, `session_messages`, `job_queue`.

---

## High‑Level Approach
We will introduce a provider abstraction with provider specified at session creation. All subsequent APIs infer provider by `sessionId`.

- Phase 1
  - Add a `CodexRunner` and provider-aware worker that dispatches by provider stored in `job_queue.provider` (copied from `sessions.provider`).
  - Switch API to session-scoped routes (`/api/sessions/...`) with provider only in `POST /api/sessions`.
  - Keep message parsers split by provider (Codex parsing deferred initially).

- Phase 2
  - Finalize DB schema (provider enums) and remove any legacy assumptions.

---

## Provider Abstraction

### Types
```ts
export type Provider = 'claude-code' | 'codex-cli';

export interface RunnerExecuteParams {
  sessionId: string;
  projectPath: string;
  prompt: string;
  model?: string;
  abortSignal: AbortSignal;
}

export type RunnerResult =
  | { success: true; durationMs: number }
  | { success: false; error: string; durationMs: number };

export interface AgentRunner {
  execute(params: RunnerExecuteParams): Promise<RunnerResult>;
  abort(): Promise<void>;
}
```

### Factory
```ts
export interface RunnerFactoryOptions {
  provider: Provider;
  sessionId: string;
  projectPath: string;
  model?: string;
}

export interface RunnerFactory {
  create(options: RunnerFactoryOptions): AgentRunner;
}
```

- `ClaudeRunner` wraps the existing `ClaudeCodeSDKService` (no behavioral changes).
- `CodexRunner` shells out to the Codex CLI with JSONL streaming, parses events, and saves via `messageService`.

---

## Codex Runner Design

### Invocation
- Resolve `codexCliPath` from config (see Config section).
- Spawn as a Bun process with JSONL output and project `cwd`.
- Command (per decision):

```bash
codex --dangerously-bypass-approvals-and-sandbox -c 'model_reasoning_effort=high' --search -m gpt-5 exec --json <query>
```

Example (Bun):
```ts
const args = [
  '--dangerously-bypass-approvals-and-sandbox',
  '-c', "model_reasoning_effort=high",
  '--search',
  '-m', 'gpt-5',
  'exec',
  '--json',
  prompt,
];

const proc = Bun.spawn({
  cmd: [config.codexCliPath, ...args],
  cwd: projectPath,
  stdout: 'pipe',
  stderr: 'pipe',
});
```

### Streaming parse
- Read `proc.stdout` as JSONL; parse each line via Zod into strict types.
- Map each event to a provider-specific message type, then to our normalized `Message` using a Codex parser.
- Persist with `messageService.saveSDKMessage(sessionId, providerMessage, providerSessionId)`.

```ts
for await (const line of readLines(proc.stdout)) {
  const evt = parseCodexEvent(line); // returns a strictly-typed union
  const providerSessionId = evt.sessionId;
  await messageService.saveSDKMessage(sessionId, toProviderMessage(evt), providerSessionId);
}
```

### Cancellation
- The Codex process must be cancellable.
- Use `AbortSignal` to kill the process: attempt `SIGTERM`, fall back to `SIGKILL` after a short timeout; on Windows, `proc.kill()` without a signal.
- Worker checks queue cancellation every 2s (same pattern as Claude) and calls `runner.abort()`.

### Resume semantics
- Initial integration: Codex doesn’t expose a resume token. We will not resume Codex sessions.
- When available in the future, store the last `provider_session_id` and pass it to the CLI.

---

## Message Parsing
Split parsers by provider and dispatch:

```ts
export type ProviderMessage = CodexMessage | ClaudeSdkMessage;

export function parseDbMessageByProvider(provider: Provider, raw: ProviderMessage, projectPath?: string): Message | null {
  return provider === 'codex-cli'
    ? parseCodexMessage(raw, projectPath)
    : parseClaudeMessage(raw, projectPath);
}
```

- `parseClaudeMessage` remains as-is (extracted from current `message-parser`).
- `parseCodexMessage` implements analogous mapping:
  - text → assistant `message`
  - tool use/results → assistant `tool_use` / `tool_result`
  - user input → user `message`
  - keep previews and file-path relativization logic.

Note: if Codex CLI’s event schema differs, implement a small adapter `toProviderMessage(evt)` to reconcile fields.

---

## Worker Changes
- Replace `ClaudeCodeSQLiteWorker` with `AgentSQLiteWorker`.
- Dispatch by job provider using `RunnerFactory`.
- Keep concurrency, polling, cancellation checker, and SSE emissions unchanged.

Pseudocode:
```ts
// provider is copied into the job row at enqueue time from sessions.provider
const provider = job.provider as Provider;
const runner = factory.create({ provider, sessionId, projectPath: data.projectPath, model: data.model });
this.activeSessions.set(promptId, runner);
startCancellationChecker(...);
const result = await runner.execute({ sessionId, projectPath: data.projectPath, prompt: data.prompt, model: data.model, abortSignal });
```

---

## API Surface

Provider is required only at session creation. All other endpoints infer provider by `sessionId`.

### Routes
- Sessions
  - `POST /api/sessions` — body: `{ projectPath: string, provider: Provider }`
  - `GET /api/sessions` — list (includes `provider` per session)
  - `GET /api/sessions/:sessionId`
  - `PATCH /api/sessions/:sessionId`
  - `DELETE /api/sessions/:sessionId`
- Messages (under a session)
  - `GET /api/sessions/:sessionId/messages/stream`
  - `POST /api/sessions/:sessionId/messages` — body: `{ content: string, model?: string, allowedTools?: string[] }`
  - `GET /api/sessions/:sessionId/messages`
  - `GET /api/sessions/:sessionId/messages/raw`
- Commands / Agents (under a session)
  - `GET /api/sessions/:sessionId/commands`
  - `GET /api/sessions/:sessionId/agents`

### Request schemas
- CreateSessionRequest
```ts
projectPath: string;
provider: Provider; // required only at session creation
```

- CreateMessageBodySchema (no provider; server validates `model` using the session's provider)
```ts
content: string;
model?: string;     // server validates using the session provider
allowedTools?: string[];
```
- `GetMessagesResponseSchema` unchanged; internal normalization guarantees consistency.

---

## Models (Provider + Model)
- `Provider` as above; model catalogs per provider exposed via a new endpoint or embedded client constants.
- Claude: keep `opus`, `sonnet`, `opus-plan`.
- Codex: single model for now — `gpt-5` (no user-facing selector initially; server validates).

---

## Database Changes

We will wipe/reset the local DB and create a provider‑agnostic schema with provider enums. No back‑compat work needed.

### New Schema (SQLite + Drizzle)

Tables:
- `sessions` (renamed from `claude_code_sessions`)
- `session_messages`
- `job_queue`

Provider enum (SQLite uses CHECK constraint; typed via Drizzle):
```ts
// drizzle/sqlite: represented as text with enum type in TS
type Provider = 'claude-code' | 'codex-cli';
```

Sessions:
```ts
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey().$defaultFn(createId),
  provider: text('provider', { enum: ['claude-code', 'codex-cli'] as const })
    .notNull(),
  projectPath: text('project_path').notNull(),
  name: text('name').notNull(),
  context: text('context'),
  // provider-specific home dir (kept nullable for portability)
  providerDirectoryPath: text('provider_directory_path'),
  metadata: text('metadata', { mode: 'json' }).$type<{ repository?: string; branch?: string; allowedTools?: string[] }>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull().$onUpdate(() => new Date()),
  lastAccessedAt: integer('last_accessed_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  // Working state
  isWorking: integer('is_working', { mode: 'boolean' }).default(false).notNull(),
  currentJobId: text('current_job_id'),
  lastJobStatus: text('last_job_status'),
  // Counters
  messageCount: integer('message_count').default(0).notNull(),
  tokenCount: integer('token_count').default(0).notNull(),
  state: text('state', { enum: ['active', 'inactive'] as const }).default('active').notNull(),
});
```

Session messages (provider stored redundantly for analytics and denormalized reads; server writes it from `sessions.provider`):
```ts
export const sessionMessages = sqliteTable('session_messages', {
  id: text('id').primaryKey().$defaultFn(createId),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['claude-code', 'codex-cli'] as const }).notNull(),
  type: text('type', { enum: ['user', 'assistant', 'system', 'result', 'error'] as const }).notNull(),
  contentData: text('content_data'), // raw provider message JSON (stringified)
  providerSessionId: text('provider_session_id'),
  tokenCount: integer('token_count'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});
```

Job queue:
```ts
export const jobQueue = sqliteTable('job_queue', {
  id: text('id').primaryKey().$defaultFn(createId),
  sessionId: text('session_id').notNull(),
  promptId: text('prompt_id').notNull(),
  provider: text('provider', { enum: ['claude-code', 'codex-cli'] as const }).notNull(),
  status: text('status', { enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'] as const }).notNull().default('pending'),
  data: text('data', { mode: 'json' }).$type<{ prompt: string; projectPath: string; allowedTools?: string[]; messageId?: string; model?: string }>().notNull(),
  attempts: integer('attempts').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(1).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  error: text('error'),
  nextRetryAt: integer('next_retry_at', { mode: 'timestamp' }),
});
```

All migrations are forwards-only; provide a safe down script that removes added columns only if empty.

---

## Config
- Extend core config with optional Codex path (Bun auto-loads `.env`, but we use a JSON file):
```ts
interface Config {
  // ...existing
  claudeCodePath?: string;
  codexCliPath?: string;
}
```
- `pokecode setup` prompts for both; validates binaries/files.

---

## Agents & Commands Discovery
- Claude: continue reading from `~/.claude/...` and `project/.claude/...`.
- Codex: no agent/command files; return empty arrays for these endpoints when `provider = 'codex-cli'`.
- API responses still include `sources` (omitted for Codex).

---

## Testing

### Unit
- RunnerFactory dispatch and error paths.
- CodexRunner: parse JSONL, map events, cancellation.
- Parsers: provider-specific mapping to `Message`.

### Integration
- Queue → Worker → Runner → DB → SSE for both providers.
- Pagination and SSE heartbeat on Codex endpoints.

### Migration
- Backfill correctness for `provider` and `provider_session_id`.
- Read paths remain stable for legacy rows.

---

## Rollout Plan
1. Phase 1 (2–3 days)
   - Implement `AgentRunner` abstraction, `ClaudeRunner` adapter, and `CodexRunner`.
   - Adopt `/api/agents/:provider/...` routes; update worker to dispatch by provider.
   - CLI `setup` accepts `codexCliPath` and shows both paths in status output.
   - Docs and runbook updates; ship behind “beta” label.
2. Phase 2 (2–4 days)
   - DB additive migration (provider columns) and optional table/column rename.
   - API schemas updated; mobile: provider-aware model picker (Claude only), Codex fixed `gpt-5`.
3. Phase 3 (0.5–1 day)
   - Cleanup of legacy aliases when safe.

---

## Risks & Mitigations
- Codex event schema mismatch → implement adapter layer; validate with fixtures before enabling.
- Cancellation reliability → ensure `AbortSignal` propagates; add timeouts and process guards.
- Performance regressions → isolate runner concurrency per provider if needed.
- Back-compat → keep aliases and old columns until clients are confirmed migrated.

---

## Decisions (clarifications incorporated)
- Codex CLI: use `codex --dangerously-bypass-approvals-and-sandbox -c 'model_reasoning_effort=high' --search -m gpt-5 exec --json <query>`; emits JSONL; we must support cancellation.
- Agents/commands: Codex has none; return empty arrays.
- API surface: provider is required only at session creation; all other endpoints infer provider by `sessionId`.
- Database: reset schema; create enums for provider; table `claude_code_sessions` is now `sessions`; add `provider` to `sessions`, `session_messages`, and `job_queue`; `session_messages.provider_session_id` replaces Claude-specific field.
- Models: Codex exposes a single model `gpt-5` for now; no user-facing model selection.
- Concurrency: single shared worker across providers.

---

## Appendix A: Example Minimal Interfaces (no assertions, no `any`)

```ts
export interface CodexEventText {
  kind: 'text';
  sessionId: string;
  content: string;
}

export interface CodexEventToolUse {
  kind: 'tool_use';
  sessionId: string;
  toolName: 'Read' | 'Bash' | 'Edit' | 'MultiEdit' | 'Grep' | 'Glob' | 'Ls' | 'Task' | 'TodoWrite';
  toolId: string;
  payload: Record<string, string | number | boolean | Array<string> | { [k: string]: string | number | boolean } >;
}

export interface CodexEventToolResult {
  kind: 'tool_result';
  sessionId: string;
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export type CodexEvent = CodexEventText | CodexEventToolUse | CodexEventToolResult;
```

The actual mapping function is deterministic and typed:

```ts
export function toProviderMessage(evt: CodexEvent): CodexMessage {
  if (evt.kind === 'text') {
    return {
      type: 'assistant',
      message: { role: 'assistant', content: evt.content },
      parent_tool_use_id: null,
      session_id: evt.sessionId
    };
  }
  if (evt.kind === 'tool_result') {
    return {
      type: 'user',
      message: {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: evt.toolUseId, content: evt.content, is_error: evt.isError === true }
        ]
      },
      parent_tool_use_id: evt.toolUseId,
      session_id: evt.sessionId
    };
  }
  // tool_use maps to assistant tool_use message in our normalized shape via parser
  return {
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [
        { type: 'tool_use', id: evt.toolId, name: evt.toolName, input: evt.payload }
      ],
      type: 'message'
    },
    parent_tool_use_id: null,
    session_id: evt.sessionId
  };
}
```

These examples are illustrative for the adapter; actual types will mirror Codex’ emitted schema once confirmed.

---

## Appendix B: AgentRunner Interface (draft)

File suggestion: `packages/core/src/services/agent-runner.ts`

```ts
// Strict provider type
export type Provider = 'claude-code' | 'codex-cli';

export interface RunnerExecuteParams {
  sessionId: string;
  projectPath: string;
  prompt: string;
  model?: string;
  abortSignal: AbortSignal;
}

export type RunnerResult =
  | { success: true; durationMs: number }
  | { success: false; error: string; durationMs: number };

export interface AgentRunner {
  execute(params: RunnerExecuteParams): Promise<RunnerResult>;
  abort(): Promise<void>;
}

export interface RunnerFactoryOptions {
  provider: Provider;
  sessionId: string;
  projectPath: string;
  model?: string;
}

export interface RunnerFactory {
  create(options: RunnerFactoryOptions): AgentRunner;
}
```

Skeletons (non-functional stubs for reference):

```ts
// Claude implementation delegates to existing ClaudeCodeSDKService
export class ClaudeRunner implements AgentRunner {
  constructor(private deps: { sessionId: string; projectPath: string; model?: string }) {}
  async execute(params: RunnerExecuteParams): Promise<RunnerResult> {
    // Wrap ClaudeCodeSDKService and translate to RunnerResult
    return { success: true, durationMs: 0 };
  }
  async abort(): Promise<void> {}
}

// Codex implementation shells out via Bun.spawn and parses JSONL
export class CodexRunner implements AgentRunner {
  private proc: Process | null = null;
  constructor(private deps: { sessionId: string; projectPath: string; model?: string; codexCliPath: string }) {}
  async execute(params: RunnerExecuteParams): Promise<RunnerResult> {
    // Phase 1: we persist raw JSONL without mapping to normalized Message yet.
    // TODO: implement JSONL read and save raw lines to session_messages.content_data via messageService.
    return { success: true, durationMs: 0 };
  }
  async abort(): Promise<void> {
    // Kill process if running
  }
}

export class DefaultRunnerFactory implements RunnerFactory {
  create(options: RunnerFactoryOptions): AgentRunner {
    if (options.provider === 'claude-code') {
      return new ClaudeRunner({ sessionId: options.sessionId, projectPath: options.projectPath, model: options.model });
    }
    // codex-cli
    // codexCliPath resolved by the caller when instantiating in production code
    throw new Error('CodexRunner requires codexCliPath in production instantiation');
  }
}
```

---

## Next Steps
- Implement `AgentRunner` + factory and wire a new `AgentSQLiteWorker`.
- Implement Canonical provider routes and provider-aware request schemas.
- Add DB columns (`provider`, `provider_session_id`) and backfill.
