import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'claude_code_users',
  {
    id: text('id').primaryKey(), // JWT sub claim
    email: text('email').notNull().unique(),
    name: text('name'),
    passwordHash: text('password_hash'),
    refreshToken: text('refresh_token'),
    metadata: jsonb('metadata').$type<{
      preferences?: Record<string, any>;
      lastDevice?: string;
    }>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastLoginAt: timestamp('last_login_at').defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index('idx_users_email').on(table.email),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
