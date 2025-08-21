-- Remove model column from sessions table since models are now per-message
ALTER TABLE `claude_code_sessions` DROP COLUMN `model`;