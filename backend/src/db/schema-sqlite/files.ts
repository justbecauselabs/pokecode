import { text, integer, sqliteTable, index } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';
import { sessions } from './sessions';

export const fileAccess = sqliteTable(
  'claude_code_file_access',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    // promptId removed - file access now tracked at session level only
    filePath: text('file_path').notNull(),
    accessType: text('access_type', { 
      enum: ['read', 'write', 'create', 'delete'] 
    }).notNull(),
    content: text('content'), // For write operations
    metadata: text('metadata', { mode: 'json' }).$type<{
      size?: number;
      mimeType?: string;
      encoding?: string;
    }>(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    sessionIdIdx: index('idx_file_access_session_id').on(table.sessionId),
    filePathIdx: index('idx_file_access_file_path').on(table.filePath),
  }),
);

export type FileAccess = typeof fileAccess.$inferSelect;
export type NewFileAccess = typeof fileAccess.$inferInsert;