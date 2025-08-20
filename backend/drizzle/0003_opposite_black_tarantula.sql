-- Add state column with default 'active'
ALTER TABLE `claude_code_sessions` ADD `state` text DEFAULT 'active' NOT NULL;

-- Backfill existing sessions based on updatedAt timestamp
-- Set to 'inactive' for sessions that haven't been updated in more than 6 hours
UPDATE `claude_code_sessions` 
SET `state` = 'inactive' 
WHERE (`updated_at` < (strftime('%s', 'now') - 6 * 3600) * 1000);