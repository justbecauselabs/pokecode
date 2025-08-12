DO $$ BEGIN
 CREATE TYPE "public"."message_type" AS ENUM('user', 'assistant');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"text" text NOT NULL,
	"type" "message_type" NOT NULL,
	"claude_session_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_messages" ADD CONSTRAINT "session_messages_session_id_claude_code_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."claude_code_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_session_messages_session_id" ON "session_messages" ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_session_messages_type" ON "session_messages" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_session_messages_created_at" ON "session_messages" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_session_messages_claude_session_id" ON "session_messages" ("claude_session_id");