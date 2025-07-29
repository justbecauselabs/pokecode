import { sql } from 'drizzle-orm';
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const sessionStatusEnum = pgEnum('session_status', ['active', 'inactive', 'archived']);

export const sessions = pgTable(
  'claude_code_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    projectPath: text('project_path').notNull(),
    context: text('context'),
    status: sessionStatusEnum('status').default('active').notNull(),
    metadata: jsonb('metadata').$type<{
      repository?: string;
      branch?: string;
      allowedTools?: string[];
    }>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
    lastAccessedAt: timestamp('last_accessed_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_sessions_user_id').on(table.userId),
    statusIdx: index('idx_sessions_status').on(table.status),
    lastAccessedIdx: index('idx_sessions_last_accessed').on(table.lastAccessedAt),
  }),
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
