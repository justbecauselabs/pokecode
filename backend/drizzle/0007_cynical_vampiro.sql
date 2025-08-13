DROP INDEX IF EXISTS "idx_sessions_status";--> statement-breakpoint
ALTER TABLE "claude_code_sessions" DROP COLUMN IF EXISTS "status";