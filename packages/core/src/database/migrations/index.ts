// Auto-generated bundled migrations for PokéCode
// This file is automatically updated when migrations are generated
// DO NOT EDIT MANUALLY - Run 'bun run generate-migration-module' instead

export const migrations = [
  {
    id: '0000_funny_cardiac',
    sql: `CREATE TABLE \`job_queue\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`session_id\` text NOT NULL,
	\`prompt_id\` text NOT NULL,
	\`status\` text DEFAULT 'pending' NOT NULL,
	\`data\` text NOT NULL,
	\`attempts\` integer DEFAULT 0 NOT NULL,
	\`max_attempts\` integer DEFAULT 3 NOT NULL,
	\`created_at\` integer NOT NULL,
	\`started_at\` integer,
	\`completed_at\` integer,
	\`error\` text,
	\`next_retry_at\` integer
);
--> statement-breakpoint
CREATE TABLE \`session_messages\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`session_id\` text NOT NULL,
	\`type\` text NOT NULL,
	\`content_data\` text,
	\`claude_code_session_id\` text,
	\`token_count\` integer,
	\`created_at\` integer NOT NULL,
	FOREIGN KEY (\`session_id\`) REFERENCES \`claude_code_sessions\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE \`claude_code_sessions\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`project_path\` text NOT NULL,
	\`name\` text NOT NULL,
	\`context\` text,
	\`claude_directory_path\` text,
	\`metadata\` text,
	\`created_at\` integer NOT NULL,
	\`updated_at\` integer NOT NULL,
	\`last_accessed_at\` integer NOT NULL,
	\`is_working\` integer DEFAULT false NOT NULL,
	\`current_job_id\` text,
	\`last_job_status\` text,
	\`message_count\` integer DEFAULT 0 NOT NULL,
	\`token_count\` integer DEFAULT 0 NOT NULL,
	\`state\` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE INDEX \`idx_job_queue_status\` ON \`job_queue\` (\`status\`);--> statement-breakpoint
CREATE INDEX \`idx_job_queue_next_retry\` ON \`job_queue\` (\`next_retry_at\`);--> statement-breakpoint
CREATE INDEX \`idx_job_queue_session_id\` ON \`job_queue\` (\`session_id\`);--> statement-breakpoint
CREATE INDEX \`idx_job_queue_created_at\` ON \`job_queue\` (\`created_at\`);--> statement-breakpoint
CREATE INDEX \`idx_session_messages_session_id\` ON \`session_messages\` (\`session_id\`);--> statement-breakpoint
CREATE INDEX \`idx_session_messages_type\` ON \`session_messages\` (\`type\`);--> statement-breakpoint
CREATE INDEX \`idx_session_messages_created_at\` ON \`session_messages\` (\`created_at\`);--> statement-breakpoint
CREATE INDEX \`idx_session_messages_claude_code_session_id\` ON \`session_messages\` (\`claude_code_session_id\`);--> statement-breakpoint
CREATE INDEX \`idx_sessions_last_accessed\` ON \`claude_code_sessions\` (\`last_accessed_at\`);--> statement-breakpoint
CREATE INDEX \`idx_sessions_is_working\` ON \`claude_code_sessions\` (\`is_working\`);`
  }
] as const;

export type Migration = typeof migrations[number];
