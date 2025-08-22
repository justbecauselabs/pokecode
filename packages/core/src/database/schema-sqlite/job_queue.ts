import { createId } from '@paralleldrive/cuid2';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const jobQueue = sqliteTable(
  'job_queue',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    sessionId: text('session_id').notNull(),
    promptId: text('prompt_id').notNull(),
    status: text('status', {
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    })
      .notNull()
      .default('pending'),
    data: text('data', { mode: 'json' })
      .$type<{
        prompt: string;
        projectPath: string;
        allowedTools?: string[];
        messageId?: string;
        model?: string;
      }>()
      .notNull(),
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(3).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    startedAt: integer('started_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    error: text('error'),
    nextRetryAt: integer('next_retry_at', { mode: 'timestamp' }),
  },
  (table) => ({
    statusIdx: index('idx_job_queue_status').on(table.status),
    nextRetryIdx: index('idx_job_queue_next_retry').on(table.nextRetryAt),
    sessionIdIdx: index('idx_job_queue_session_id').on(table.sessionId),
    createdAtIdx: index('idx_job_queue_created_at').on(table.createdAt),
  }),
);

export type Job = typeof jobQueue.$inferSelect;
export type NewJob = typeof jobQueue.$inferInsert;
