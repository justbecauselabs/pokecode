ALTER TABLE `sessions` ADD `last_message_sent_at` integer;--> statement-breakpoint
CREATE INDEX `idx_sessions_last_message_sent` ON `sessions` (`last_message_sent_at`);