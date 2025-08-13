ALTER TABLE "session_messages" ADD COLUMN "content_data" jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_session_messages_content_data" ON "session_messages" ("content_data");