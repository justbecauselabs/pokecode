// Auto-generated bundled migrations for PokéCode
// This file is automatically updated when migrations are generated
// DO NOT EDIT MANUALLY - Run 'bun run generate-migration-module' instead

export const migrations = [
  {
    id: '0000_funny_cardiac',
    // Aligned to current Drizzle schema (sessions, session_messages, job_queue)
    sql: `CREATE TABLE \`sessions\` (
\t\`id\` text PRIMARY KEY NOT NULL,
\t\`provider\` text NOT NULL,
\t\`project_path\` text NOT NULL,
\t\`name\` text NOT NULL,
\t\`context\` text,
\t\`claude_directory_path\` text,
\t\`metadata\` text,
\t\`created_at\` integer NOT NULL,
\t\`updated_at\` integer NOT NULL,
\t\`last_accessed_at\` integer NOT NULL,
\t\`is_working\` integer DEFAULT false NOT NULL,
\t\`current_job_id\` text,
\t\`last_job_status\` text,
\t\`message_count\` integer DEFAULT 0 NOT NULL,
\t\`token_count\` integer DEFAULT 0 NOT NULL,
\t\`state\` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE INDEX \`idx_sessions_last_accessed\` ON \`sessions\` (\`last_accessed_at\`);--> statement-breakpoint
CREATE INDEX \`idx_sessions_is_working\` ON \`sessions\` (\`is_working\`);--> statement-breakpoint
CREATE TABLE \`session_messages\` (
\t\`id\` text PRIMARY KEY NOT NULL,
\t\`session_id\` text NOT NULL,
\t\`provider\` text NOT NULL,
\t\`type\` text NOT NULL,
\t\`content_data\` text,
\t\`provider_session_id\` text,
\t\`token_count\` integer,
\t\`created_at\` integer NOT NULL,
\tFOREIGN KEY (\`session_id\`) REFERENCES \`sessions\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX \`idx_session_messages_session_id\` ON \`session_messages\` (\`session_id\`);--> statement-breakpoint
CREATE INDEX \`idx_session_messages_type\` ON \`session_messages\` (\`type\`);--> statement-breakpoint
CREATE INDEX \`idx_session_messages_created_at\` ON \`session_messages\` (\`created_at\`);--> statement-breakpoint
CREATE INDEX \`idx_session_messages_provider\` ON \`session_messages\` (\`provider\`);--> statement-breakpoint
CREATE INDEX \`idx_session_messages_provider_session_id\` ON \`session_messages\` (\`provider_session_id\`);--> statement-breakpoint
CREATE TABLE \`job_queue\` (
\t\`id\` text PRIMARY KEY NOT NULL,
\t\`session_id\` text NOT NULL,
\t\`prompt_id\` text NOT NULL,
\t\`provider\` text NOT NULL,
\t\`status\` text DEFAULT 'pending' NOT NULL,
\t\`data\` text NOT NULL,
\t\`attempts\` integer DEFAULT 0 NOT NULL,
\t\`max_attempts\` integer DEFAULT 3 NOT NULL,
\t\`created_at\` integer NOT NULL,
\t\`started_at\` integer,
\t\`completed_at\` integer,
\t\`error\` text,
\t\`next_retry_at\` integer
);
--> statement-breakpoint
CREATE INDEX \`idx_job_queue_status\` ON \`job_queue\` (\`status\`);--> statement-breakpoint
CREATE INDEX \`idx_job_queue_next_retry\` ON \`job_queue\` (\`next_retry_at\`);--> statement-breakpoint
CREATE INDEX \`idx_job_queue_session_id\` ON \`job_queue\` (\`session_id\`);--> statement-breakpoint
CREATE INDEX \`idx_job_queue_created_at\` ON \`job_queue\` (\`created_at\`);--> statement-breakpoint
CREATE INDEX \`idx_job_queue_provider\` ON \`job_queue\` (\`provider\`);`
  }
] as const;

export type Migration = typeof migrations[number];

