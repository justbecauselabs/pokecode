-- Add optional token_count to session_messages
ALTER TABLE `session_messages` ADD `token_count` integer;

-- Add message_count and token_count to sessions with proper defaults
ALTER TABLE `claude_code_sessions` ADD `message_count` integer DEFAULT 0;
ALTER TABLE `claude_code_sessions` ADD `token_count` integer DEFAULT 0;

-- Update existing sessions to have proper message counts based on existing messages
UPDATE `claude_code_sessions` 
SET `message_count` = (
  SELECT COUNT(*) 
  FROM `session_messages` 
  WHERE `session_messages`.`session_id` = `claude_code_sessions`.`id`
);

-- Set token_count to 0 for existing sessions (they can be recalculated if needed)
UPDATE `claude_code_sessions` 
SET `token_count` = 0 
WHERE `token_count` IS NULL;