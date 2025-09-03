import { createId } from '@paralleldrive/cuid2';
import { PROVIDER_VALUES } from '@pokecode/types';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sessions } from './sessions';

export const sessionMessages = sqliteTable(
  'session_messages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    provider: text('provider', { enum: PROVIDER_VALUES }).notNull(),
    type: text('type', {
      enum: ['user', 'assistant', 'system', 'result', 'error'] as const,
    }).notNull(),
    contentData: text('content_data'), // Provider message data stored as JSON string
    providerSessionId: text('provider_session_id'), // Provider-specific session ID for resumption
    tokenCount: integer('token_count'), // Optional token count for this specific message
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    sessionIdIdx: index('idx_session_messages_session_id').on(table.sessionId),
    typeIdx: index('idx_session_messages_type').on(table.type),
    createdAtIdx: index('idx_session_messages_created_at').on(table.createdAt),
    providerIdx: index('idx_session_messages_provider').on(table.provider),
    providerSessionIdIdx: index('idx_session_messages_provider_session_id').on(
      table.providerSessionId,
    ),
  }),
);

export type SessionMessage = typeof sessionMessages.$inferSelect;
export type NewSessionMessage = typeof sessionMessages.$inferInsert;
