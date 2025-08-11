import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sessions } from './sessions';

export const fileAccessEnum = pgEnum('file_access_type', ['read', 'write', 'create', 'delete']);

export const fileAccess = pgTable(
  'claude_code_file_access',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    // promptId removed - file access now tracked at session level only
    filePath: text('file_path').notNull(),
    accessType: fileAccessEnum('access_type').notNull(),
    content: text('content'), // For write operations
    metadata: jsonb('metadata').$type<{
      size?: number;
      mimeType?: string;
      encoding?: string;
    }>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    sessionIdIdx: index('idx_file_access_session_id').on(table.sessionId),
    filePathIdx: index('idx_file_access_file_path').on(table.filePath),
  }),
);

export type FileAccess = typeof fileAccess.$inferSelect;
export type NewFileAccess = typeof fileAccess.$inferInsert;
