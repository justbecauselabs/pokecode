import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sessions } from './sessions';

export const promptStatusEnum = pgEnum('prompt_status', [
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled',
]);

export const prompts = pgTable(
  'claude_code_prompts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    prompt: text('prompt').notNull(),
    response: text('response'),
    status: promptStatusEnum('status').default('queued').notNull(),
    jobId: text('job_id'), // BullMQ job ID
    error: text('error'),
    metadata: jsonb('metadata').$type<{
      allowedTools?: string[];
      toolCalls?: Array<{ tool: string; params: any; result?: any }>;
      duration?: number;
      tokenCount?: number;
    }>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (table) => ({
    sessionIdIdx: index('idx_prompts_session_id').on(table.sessionId),
    statusIdx: index('idx_prompts_status').on(table.status),
    jobIdIdx: index('idx_prompts_job_id').on(table.jobId),
  }),
);

export type Prompt = typeof prompts.$inferSelect;
export type NewPrompt = typeof prompts.$inferInsert;
