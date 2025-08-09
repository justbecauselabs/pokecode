-- Add password_hash column to users for credential-based auth
ALTER TABLE "claude_code_users"
  ADD COLUMN IF NOT EXISTS "password_hash" text;

