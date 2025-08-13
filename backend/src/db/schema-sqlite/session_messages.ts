import { text, integer, sqliteTable, index } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';
import { sessions } from './sessions';

export const sessionMessages = sqliteTable(
  'session_messages',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['user', 'assistant'] }).notNull(),
    contentData: text('content_data'), // SDK message data stored as JSON string
    claudeCodeSessionId: text('claude_code_session_id'), // Claude SDK session ID for resumption
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    sessionIdIdx: index('idx_session_messages_session_id').on(table.sessionId),
    typeIdx: index('idx_session_messages_type').on(table.type),
    createdAtIdx: index('idx_session_messages_created_at').on(table.createdAt),
    claudeCodeSessionIdIdx: index('idx_session_messages_claude_code_session_id').on(
      table.claudeCodeSessionId,
    ),
  }),
);

export type SessionMessage = typeof sessionMessages.$inferSelect;
export type NewSessionMessage = typeof sessionMessages.$inferInsert;