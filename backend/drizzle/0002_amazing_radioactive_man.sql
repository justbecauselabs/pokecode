DROP TABLE "claude_code_prompts";--> statement-breakpoint
ALTER TABLE "claude_code_file_access" DROP CONSTRAINT "claude_code_file_access_prompt_id_claude_code_prompts_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_file_access_prompt_id";--> statement-breakpoint
ALTER TABLE "claude_code_file_access" DROP COLUMN IF EXISTS "prompt_id";