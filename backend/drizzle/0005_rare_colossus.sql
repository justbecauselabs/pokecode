ALTER TABLE "claude_code_sessions" ADD COLUMN "is_working" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "claude_code_sessions" ADD COLUMN "current_job_id" text;--> statement-breakpoint
ALTER TABLE "claude_code_sessions" ADD COLUMN "last_job_status" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_is_working" ON "claude_code_sessions" ("is_working");