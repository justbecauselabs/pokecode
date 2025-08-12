import { index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sessions } from './sessions';

export const messageTypeEnum = pgEnum('message_type', ['user', 'assistant']);

export const sessionMessages = pgTable(
  'session_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    type: messageTypeEnum('type').notNull(),
    claudeSessionId: text('claude_session_id'), // For correlating with JSONL files
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    sessionIdIdx: index('idx_session_messages_session_id').on(table.sessionId),
    typeIdx: index('idx_session_messages_type').on(table.type),
    createdAtIdx: index('idx_session_messages_created_at').on(table.createdAt),
    claudeSessionIdIdx: index('idx_session_messages_claude_session_id').on(table.claudeSessionId),
  }),
);

export type SessionMessage = typeof sessionMessages.$inferSelect;
export type NewSessionMessage = typeof sessionMessages.$inferInsert;
