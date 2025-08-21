-- Add model column to sessions table with default 'sonnet'
ALTER TABLE `claude_code_sessions` ADD `model` text DEFAULT 'sonnet' NOT NULL;

-- Backfill existing sessions with default model
UPDATE `claude_code_sessions` 
SET `model` = 'sonnet' 
WHERE `model` IS NULL;