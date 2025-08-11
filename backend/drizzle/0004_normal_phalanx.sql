DROP TABLE "claude_code_users";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_sessions_user_id";--> statement-breakpoint
ALTER TABLE "claude_code_sessions" DROP COLUMN IF EXISTS "user_id";