# Database Documentation

This guide covers database operations, migrations, and CRUD patterns using Drizzle ORM with PostgreSQL.

## Database Configuration

The database connection is configured in `/src/db/index.ts`:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getDatabaseUrl } from '@/config';
import * as schema from './schema';

const sql = postgres(getDatabaseUrl());
export const db = drizzle(sql, { schema });
```

## Schema Definition

Schemas are defined using Drizzle's PostgreSQL schema builder in `/src/db/schema/`:

### Example Schema (users.ts)

```typescript
import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'claude_code_users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name'),
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

// Type inference
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

## Migration Procedures

### Generate a Migration

After modifying schema files, generate a migration:

```bash
pnpm migrate:generate
```

This creates a new migration file in the `/drizzle` directory.

### Run Migrations

Apply pending migrations to the database:

```bash
pnpm migrate
```

Or use the migration script directly:

```typescript
// scripts/migrate.ts
import { migrate } from 'drizzle-orm/postgres-js/migrator';

await migrate(db, { migrationsFolder: './drizzle' });
```

### Push Schema Changes (Development)

For rapid development, push schema changes directly without migrations:

```bash
pnpm migrate:push
```

⚠️ **Warning**: Only use in development. This can cause data loss.

### Database Studio

Explore your database with Drizzle Studio:

```bash
pnpm migrate:studio
```

## CRUD Operations

### Create (INSERT)

```typescript
import { db } from '@/db';
import { users } from '@/db/schema';

// Single insert
const newUser = await db.insert(users).values({
  id: 'user_123',
  email: 'user@example.com',
  name: 'John Doe'
}).returning();

// Bulk insert
const newUsers = await db.insert(users).values([
  { id: 'user_1', email: 'user1@example.com', name: 'User 1' },
  { id: 'user_2', email: 'user2@example.com', name: 'User 2' }
]).returning();

// Insert with conflict handling
const user = await db.insert(users)
  .values({ id, email, name })
  .onConflictDoUpdate({
    target: users.email,
    set: { name, lastLoginAt: new Date() }
  })
  .returning();
```

### Read (SELECT)

```typescript
import { db } from '@/db';
import { users, sessions } from '@/db/schema';
import { eq, and, desc, like, gte } from 'drizzle-orm';

// Find by ID
const user = await db.query.users.findFirst({
  where: eq(users.id, userId)
});

// Find with conditions
const activeUsers = await db.select()
  .from(users)
  .where(
    and(
      gte(users.lastLoginAt, new Date('2024-01-01')),
      like(users.email, '%@company.com')
    )
  )
  .orderBy(desc(users.createdAt));

// With relations
const userWithSessions = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: {
    sessions: {
      orderBy: desc(sessions.createdAt),
      limit: 10
    }
  }
});

// Pagination
const page = 1;
const limit = 20;
const offset = (page - 1) * limit;

const paginatedUsers = await db.select()
  .from(users)
  .limit(limit)
  .offset(offset);

// Count total
const [{ count }] = await db.select({ 
  count: sql<number>`count(*)::int` 
})
.from(users);
```

### Update

```typescript
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Update single record
const updatedUser = await db.update(users)
  .set({ 
    name: 'New Name',
    lastLoginAt: new Date()
  })
  .where(eq(users.id, userId))
  .returning();

// Update with JSON operations
const updated = await db.update(users)
  .set({
    metadata: sql`
      jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{preferences,theme}',
        '"dark"'
      )
    `
  })
  .where(eq(users.id, userId))
  .returning();

// Conditional update
const result = await db.update(users)
  .set({ refreshToken: newToken })
  .where(
    and(
      eq(users.id, userId),
      eq(users.refreshToken, oldToken)
    )
  )
  .returning();

if (result.length === 0) {
  throw new Error('Token mismatch');
}
```

### Delete

```typescript
import { db } from '@/db';
import { users, sessions } from '@/db/schema';
import { eq, lt } from 'drizzle-orm';

// Delete single record
const deletedUser = await db.delete(users)
  .where(eq(users.id, userId))
  .returning();

// Delete with conditions
const deletedSessions = await db.delete(sessions)
  .where(
    and(
      eq(sessions.userId, userId),
      lt(sessions.lastActiveAt, thirtyDaysAgo)
    )
  );

// Cascade delete (if not handled by foreign keys)
await db.transaction(async (tx) => {
  await tx.delete(sessions).where(eq(sessions.userId, userId));
  await tx.delete(users).where(eq(users.id, userId));
});
```

## Transactions

Use transactions for atomic operations:

```typescript
import { db } from '@/db';

const result = await db.transaction(async (tx) => {
  // Create user
  const [user] = await tx.insert(users)
    .values({ id, email, name })
    .returning();

  // Create initial session
  const [session] = await tx.insert(sessions)
    .values({
      id: generateId(),
      userId: user.id,
      title: 'Welcome Session'
    })
    .returning();

  // Create welcome prompt
  await tx.insert(prompts)
    .values({
      id: generateId(),
      sessionId: session.id,
      userId: user.id,
      content: 'Welcome to Claude Code!'
    });

  return { user, session };
});

// Transaction with rollback
try {
  await db.transaction(async (tx) => {
    await tx.insert(users).values(userData);
    
    if (someCondition) {
      tx.rollback(); // Manually rollback
    }
    
    await tx.insert(sessions).values(sessionData);
  });
} catch (error) {
  // Transaction rolled back
  console.error('Transaction failed:', error);
}
```

## Raw SQL Queries

When needed, use raw SQL with type safety:

```typescript
import { sql } from 'drizzle-orm';

// Raw query with parameters
const result = await db.execute(sql`
  SELECT u.*, COUNT(s.id) as session_count
  FROM claude_code_users u
  LEFT JOIN claude_code_sessions s ON u.id = s.user_id
  WHERE u.created_at >= ${startDate}
  GROUP BY u.id
  ORDER BY session_count DESC
  LIMIT ${limit}
`);

// Type the result
interface UserStats {
  id: string;
  email: string;
  session_count: number;
}

const stats = result.rows as UserStats[];
```

## Database Helpers

### Connection Health Check

```typescript
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await db.execute(sql`SELECT 1`);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
```

### Migration Status

```typescript
export async function getMigrationStatus() {
  const applied = await db.execute(sql`
    SELECT * FROM drizzle_migrations 
    ORDER BY created_at DESC
  `);
  
  return applied.rows;
}
```

## Best Practices

1. **Use TypeScript Types**: Leverage Drizzle's type inference
   ```typescript
   type User = typeof users.$inferSelect;
   type NewUser = typeof users.$inferInsert;
   ```

2. **Index Strategy**: Add indexes for frequently queried columns
   ```typescript
   emailIdx: index('idx_users_email').on(table.email)
   ```

3. **Transaction Usage**: Use transactions for related operations
4. **Error Handling**: Always handle database errors appropriately
5. **Connection Pooling**: PostgreSQL.js handles this automatically
6. **Query Optimization**: Use `EXPLAIN ANALYZE` for slow queries
7. **Data Validation**: Validate data before database operations

## Common Patterns

### Upsert Pattern

```typescript
const upserted = await db.insert(users)
  .values(userData)
  .onConflictDoUpdate({
    target: users.email,
    set: {
      name: userData.name,
      lastLoginAt: new Date()
    }
  })
  .returning();
```

### Soft Delete Pattern

```typescript
// Add deletedAt column to schema
deletedAt: timestamp('deleted_at'),

// Soft delete
await db.update(users)
  .set({ deletedAt: new Date() })
  .where(eq(users.id, userId));

// Query non-deleted
const activeUsers = await db.select()
  .from(users)
  .where(isNull(users.deletedAt));
```

### Audit Trail Pattern

```typescript
// Create audit log entry
await db.insert(auditLogs).values({
  id: generateId(),
  userId: currentUser.id,
  action: 'UPDATE',
  tableName: 'users',
  recordId: userId,
  changes: JSON.stringify(changes),
  createdAt: new Date()
});
```