import { text, integer, sqliteTable, index } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';

export const sessions = sqliteTable(
  'claude_code_sessions',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    projectPath: text('project_path').notNull(),
    name: text('name').notNull(), // Name derived from the last path component of projectPath
    context: text('context'),
    claudeDirectoryPath: text('claude_directory_path'), // Path to ~/.claude directory for this session
    metadata: text('metadata', { mode: 'json' }).$type<{
      repository?: string;
      branch?: string;
      allowedTools?: string[];
    }>(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull()
      .$onUpdate(() => new Date()),
    lastAccessedAt: integer('last_accessed_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    // Working state fields
    isWorking: integer('is_working', { mode: 'boolean' }).default(false).notNull(),
    currentJobId: text('current_job_id'),
    lastJobStatus: text('last_job_status'),
  },
  (table) => ({
    lastAccessedIdx: index('idx_sessions_last_accessed').on(table.lastAccessedAt),
    isWorkingIdx: index('idx_sessions_is_working').on(table.isWorking),
  }),
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;