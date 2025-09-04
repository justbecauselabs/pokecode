# Database Schema

This is the authoritative reference for PokéCode’s SQLite schema in `@pokecode/core` (Drizzle ORM, `bun:sqlite`). Columns are typed in code; names below reflect actual table DDL.

## Tables

- `sessions`
  - `id` (text, pk)
  - `provider` (text enum: `claude-code | codex-cli`)
  - `project_path` (text, not null)
  - `name` (text, not null)
  - `context` (text, nullable)
  - `claude_directory_path` (text, nullable)
  - `metadata` (json text, nullable)
    - shape: `{ repository?: string; branch?: string; allowedTools?: string[] }`
  - `created_at` (timestamp)
  - `updated_at` (timestamp, auto update)
  - `last_accessed_at` (timestamp)
  - Working state
    - `is_working` (boolean, default false)
    - `current_job_id` (text, nullable)
    - `last_job_status` (text, nullable)
  - Counters
    - `message_count` (integer, default 0)
    - `token_count` (integer, default 0)
  - `state` (text enum: `active | inactive`, default `active`)
  - Indexes: `idx_sessions_last_accessed(last_accessed_at)`, `idx_sessions_is_working(is_working)`

- `session_messages`
  - `id` (text, pk)
  - `session_id` (text, fk → `sessions.id` on delete cascade)
  - `provider` (text enum: `claude-code | codex-cli`)
  - `type` (text enum: `user | assistant | system | result | error`)
  - `content_data` (text, raw provider message JSON)
  - `provider_session_id` (text, optional resume token)
  - `token_count` (integer, optional per‑message tokens)
  - `created_at` (timestamp)
  - Indexes: `idx_session_messages_session_id`, `idx_session_messages_type`, `idx_session_messages_created_at`, `idx_session_messages_provider`, `idx_session_messages_provider_session_id`

- `job_queue`
  - `id` (text, pk)
  - `session_id` (text)
  - `prompt_id` (text)
  - `status` (text enum: `pending | processing | completed | failed | cancelled`, default `pending`)
  - `data` (json text) — shape persisted from `PromptJobData`:
    - `prompt` (string)
    - `projectPath` (string)
    - `allowedTools?` (string[])
    - `messageId?` (string)
    - `model?` (string)
  - `attempts` (integer, default 0)
  - `max_attempts` (integer, default 3)
  - Timestamps: `created_at`, `started_at?`, `completed_at?`
  - Error fields: `error?` (text), `next_retry_at?` (timestamp)
  - Indexes: `idx_job_queue_status`, `idx_job_queue_next_retry`, `idx_job_queue_session_id`, `idx_job_queue_created_at`

## Relationships

- `session_messages.session_id` → `claude_code_sessions.id` (cascade delete)
- Jobs are associated via `job_queue.session_id`; prompts refer to `prompt_id` and optional `messageId`.

## Migrations

- Source of truth: Drizzle table definitions in `src/database/schema-sqlite/*`.
- Generated SQL: versioned files under `src/database/migrations/*.sql` (via `drizzle-kit generate`).
- Runner: Drizzle ORM migrator (`drizzle-orm/bun-sqlite/migrator`) invoked by `initDatabase({ runMigrations: true })`.
- Packaging: `.sql` files are embedded via `bunfig.toml` assets for compiled CLI builds.

## Common Tasks

- Generate new SQL: `bun run db:generate`
- Push schema to DB: `bun run db:push`
- Open studio: `bun run db:studio`

## Notes

- WAL, cache size, and foreign keys are configured in `src/database/index.ts`.
- In tests (`NODE_ENV=test`), DB path defaults to `:memory:`.
- Message `content_data` stores the full provider event; API‑friendly shape is derived via `src/utils/provider-message-parser.ts`.
