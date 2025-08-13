# Database Documentation

## Overview

The backend uses PostgreSQL with Drizzle ORM for type-safe database operations. The database design supports session management, message history, and file metadata with proper relationships and constraints.

## Technology Stack

- **Database**: PostgreSQL
- **ORM**: Drizzle ORM v0.30.10
- **Migrations**: Drizzle Kit
- **Connection Pool**: Built-in PostgreSQL pooling
- **Type Safety**: Full TypeScript integration

## Database Schema

### Sessions Table
Primary table for managing Claude Code sessions.

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_path TEXT NOT NULL,
  claude_directory_path TEXT NOT NULL,
  context TEXT,
  status VARCHAR(10) NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  is_working BOOLEAN DEFAULT false,
  current_job_id TEXT,
  last_job_status TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_accessed_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_last_accessed ON sessions(last_accessed_at);
CREATE INDEX idx_sessions_project_path ON sessions(project_path);
```

**Fields:**
- `id`: Unique session identifier (UUID)
- `project_path`: Absolute path to project directory
- `claude_directory_path`: Path to Claude configuration directory
- `context`: Optional session description (max 5000 chars)
- `status`: Session state (`active`, `inactive`, `archived`)
- `metadata`: JSON storage for flexible data
- `is_working`: Indicates if session is processing
- `current_job_id`: Active job identifier
- `last_job_status`: Status of last job (`completed`, `failed`, etc.)

### Session Messages Table
Stores conversation history between users and Claude.

```sql
CREATE TABLE session_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  type VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_messages_session_id ON session_messages(session_id);
CREATE INDEX idx_messages_created_at ON session_messages(created_at);
```

**Fields:**
- `id`: Unique message identifier
- `session_id`: Foreign key to sessions table
- `text`: Message content
- `type`: Message role (`user` or `assistant`)
- `created_at`: Message timestamp

### Files Table
Tracks file metadata and content.

```sql
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT,
  encoding VARCHAR(20) DEFAULT 'utf-8',
  size INTEGER,
  mime_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_files_session_path ON files(session_id, path);
CREATE INDEX idx_files_session_id ON files(session_id);
CREATE INDEX idx_files_updated_at ON files(updated_at);
```

**Fields:**
- `id`: Unique file identifier
- `session_id`: Foreign key to sessions table
- `path`: Relative file path within project
- `content`: File content (text files only)
- `encoding`: Character encoding
- `size`: File size in bytes
- `mime_type`: MIME type for content
- `created_at`: File creation timestamp
- `updated_at`: Last modification timestamp

## Drizzle ORM Configuration

### Schema Definition (`src/db/schema.ts`)
```typescript
import { pgTable, uuid, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectPath: text('project_path').notNull(),
  claudeDirectoryPath: text('claude_directory_path').notNull(),
  context: text('context'),
  status: text('status').notNull().default('active'),
  metadata: jsonb('metadata').default({}),
  isWorking: boolean('is_working').default(false),
  currentJobId: text('current_job_id'),
  lastJobStatus: text('last_job_status'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastAccessedAt: timestamp('last_accessed_at').defaultNow()
});

export const sessionMessages = pgTable('session_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  type: text('type').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});
```

### Database Connection (`src/db/index.ts`)
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const queryClient = postgres({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Connection pool size
  idle_timeout: 30
});

export const db = drizzle(queryClient, { schema });
```

## Migrations

### Running Migrations
```bash
# Generate migration from schema changes
bun run db:generate

# Apply migrations to database
bun run db:migrate

# Open Drizzle Studio for visual management
bun run db:studio
```

### Migration Files
Located in `/drizzle` directory with timestamp prefixes:
```
drizzle/
├── 0000_initial_schema.sql
├── 0001_add_session_messages.sql
├── 0002_add_file_tracking.sql
└── meta/
    └── _journal.json
```

## Query Patterns

### Session Operations
```typescript
// Create session
const session = await db.insert(sessions).values({
  projectPath: '/path/to/project',
  claudeDirectoryPath: '/home/.claude/project',
  context: 'Working on feature X',
  metadata: { repository: 'my-repo' }
}).returning();

// Find active sessions
const activeSessions = await db.query.sessions.findMany({
  where: eq(sessions.status, 'active'),
  orderBy: [desc(sessions.lastAccessedAt)],
  limit: 20
});

// Update session state
await db.update(sessions)
  .set({ 
    isWorking: true,
    currentJobId: jobId,
    updatedAt: new Date()
  })
  .where(eq(sessions.id, sessionId));
```

### Message Operations
```typescript
// Store message
await db.insert(sessionMessages).values({
  sessionId,
  text: messageContent,
  type: 'user',
  claudeSessionId
});

// Get conversation history
const messages = await db.query.sessionMessages.findMany({
  where: eq(sessionMessages.sessionId, sessionId),
  orderBy: [asc(sessionMessages.createdAt)]
});

// Count messages
const messageCount = await db
  .select({ count: count() })
  .from(sessionMessages)
  .where(eq(sessionMessages.sessionId, sessionId));
```

### File Operations
```typescript
// Track file
await db.insert(files).values({
  sessionId,
  path: 'src/index.js',
  content: fileContent,
  size: Buffer.byteLength(fileContent),
  mimeType: 'text/javascript'
});

// List files
const projectFiles = await db.query.files.findMany({
  where: eq(files.sessionId, sessionId),
  orderBy: [asc(files.path)]
});
```

## Relationships

### Entity Relationships
```
sessions (1) ─────┬──── (N) session_messages
                  │
                  └──── (N) files
```

### Cascade Deletes
- Deleting a session automatically deletes:
  - All associated messages
  - All tracked files
  - Related job data

## Indexes and Performance

### Index Strategy
1. **Primary Keys**: UUID with B-tree indexes
2. **Foreign Keys**: Indexed for join performance
3. **Query Patterns**: Indexes on commonly filtered columns
4. **Timestamp Indexes**: For time-based queries

### Query Optimization
```typescript
// Use selective queries
const session = await db.query.sessions.findFirst({
  where: eq(sessions.id, id),
  columns: {
    id: true,
    projectPath: true,
    isWorking: true
  }
});

// Batch operations
await db.insert(sessionMessages).values(messages);

// Use transactions for consistency
await db.transaction(async (tx) => {
  await tx.update(sessions).set({ isWorking: true });
  await tx.insert(sessionMessages).values(message);
});
```

## Connection Pooling

### Configuration
```typescript
{
  max: 20,              // Maximum connections
  idleTimeoutMillis: 30000,  // Idle timeout
  connectionTimeoutMillis: 2000  // Connection timeout
}
```

### Best Practices
- Use connection pool for all queries
- Avoid long-running transactions
- Release connections promptly
- Monitor pool statistics

## Backup and Recovery

### Backup Strategy
```bash
# Manual backup
pg_dump -h localhost -U user -d pokecode > backup.sql

# Scheduled backup (cron)
0 2 * * * pg_dump -h localhost -U user -d pokecode > /backups/pokecode_$(date +\%Y\%m\%d).sql
```

### Recovery
```bash
# Restore from backup
psql -h localhost -U user -d pokecode < backup.sql

# Point-in-time recovery
pg_restore -h localhost -U user -d pokecode backup.dump
```

## Monitoring

### Health Checks
```typescript
// Database health check
async checkDatabaseHealth() {
  try {
    const result = await db.execute(sql`SELECT 1`);
    return { status: 'healthy' };
  } catch (error) {
    return { status: 'unhealthy', error };
  }
}
```

### Performance Monitoring
```sql
-- Slow query log
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC;

-- Connection stats
SELECT count(*) as connections,
       state
FROM pg_stat_activity
GROUP BY state;

-- Table sizes
SELECT schemaname,
       tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Security

### Access Control
- Use environment variables for credentials
- Implement row-level security where needed
- Sanitize all user inputs
- Use parameterized queries (handled by Drizzle)

### Data Protection
```typescript
// Never log sensitive data
logger.info({ sessionId }, 'Session created'); // Good
logger.info({ password }, 'User login'); // Bad

// Encrypt sensitive fields if needed
const encrypted = await encrypt(sensitiveData);
await db.insert(sessions).values({
  metadata: { encrypted }
});
```

## Maintenance

### Regular Tasks
1. **Vacuum**: Run `VACUUM ANALYZE` weekly
2. **Reindex**: Rebuild indexes monthly
3. **Archive**: Move old sessions to archive tables
4. **Cleanup**: Remove orphaned records

### Archive Strategy
```sql
-- Archive old sessions
INSERT INTO archived_sessions
SELECT * FROM sessions
WHERE last_accessed_at < NOW() - INTERVAL '90 days';

-- Delete archived sessions
DELETE FROM sessions
WHERE last_accessed_at < NOW() - INTERVAL '90 days';
```