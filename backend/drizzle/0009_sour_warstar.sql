DROP INDEX IF EXISTS "idx_session_messages_content_data";--> statement-breakpoint
ALTER TABLE "session_messages" ALTER COLUMN "content_data" SET DATA TYPE text;