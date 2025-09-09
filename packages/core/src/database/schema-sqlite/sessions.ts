import { createId } from '@paralleldrive/cuid2';
import { PROVIDER_VALUES } from '@pokecode/types';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    provider: text('provider', { enum: PROVIDER_VALUES }).notNull(),
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
    // Token and message tracking
    messageCount: integer('message_count').default(0).notNull(),
    tokenCount: integer('token_count').default(0).notNull(),
    // Last time a message was sent in this session (user or assistant)
    lastMessageSentAt: integer('last_message_sent_at', { mode: 'timestamp' }),
    // Session state
    state: text('state', { enum: ['active', 'inactive'] as const })
      .default('active')
      .notNull(),
  },
  (table) => ({
    lastAccessedIdx: index('idx_sessions_last_accessed').on(table.lastAccessedAt),
    isWorkingIdx: index('idx_sessions_is_working').on(table.isWorking),
    // New index to optimize ordering by last message timestamp
    lastMessageSentIdx: index('idx_sessions_last_message_sent').on(table.lastMessageSentAt),
  }),
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
