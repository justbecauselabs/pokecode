DO $$ BEGIN
 CREATE TYPE "public"."file_access_type" AS ENUM('read', 'write', 'create', 'delete');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."prompt_status" AS ENUM('queued', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."session_status" AS ENUM('active', 'inactive', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "claude_code_file_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"prompt_id" uuid,
	"file_path" text NOT NULL,
	"access_type" "file_access_type" NOT NULL,
	"content" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "claude_code_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"response" text,
	"status" "prompt_status" DEFAULT 'queued' NOT NULL,
	"job_id" text,
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "claude_code_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_path" text NOT NULL,
	"context" text,
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "claude_code_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"refresh_token" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "claude_code_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "claude_code_file_access" ADD CONSTRAINT "claude_code_file_access_session_id_claude_code_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."claude_code_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "claude_code_file_access" ADD CONSTRAINT "claude_code_file_access_prompt_id_claude_code_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."claude_code_prompts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "claude_code_prompts" ADD CONSTRAINT "claude_code_prompts_session_id_claude_code_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."claude_code_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_access_session_id" ON "claude_code_file_access" ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_access_prompt_id" ON "claude_code_file_access" ("prompt_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_access_file_path" ON "claude_code_file_access" ("file_path");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_prompts_session_id" ON "claude_code_prompts" ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_prompts_status" ON "claude_code_prompts" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_prompts_job_id" ON "claude_code_prompts" ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_user_id" ON "claude_code_sessions" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_status" ON "claude_code_sessions" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_last_accessed" ON "claude_code_sessions" ("last_accessed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "claude_code_users" ("email");