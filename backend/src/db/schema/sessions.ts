import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const sessionStatusEnum = pgEnum('session_status', ['active', 'inactive', 'archived']);

export const sessions = pgTable(
  'claude_code_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectPath: text('project_path').notNull(),
    context: text('context'),
    status: sessionStatusEnum('status').default('active').notNull(),
    claudeDirectoryPath: text('claude_directory_path'), // Path to ~/.claude directory for this session
    claudeCodeSessionId: text('claude_code_session_id'), // Actual Claude Code CLI session ID (captured after first prompt)
    metadata: jsonb('metadata').$type<{
      repository?: string;
      branch?: string;
      allowedTools?: string[];
    }>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    lastAccessedAt: timestamp('last_accessed_at').defaultNow().notNull(),
    // Working state fields
    isWorking: boolean('is_working').default(false).notNull(),
    currentJobId: text('current_job_id'),
    lastJobStatus: text('last_job_status'),
  },
  (table) => ({
    statusIdx: index('idx_sessions_status').on(table.status),
    lastAccessedIdx: index('idx_sessions_last_accessed').on(table.lastAccessedAt),
    isWorkingIdx: index('idx_sessions_is_working').on(table.isWorking),
  }),
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
