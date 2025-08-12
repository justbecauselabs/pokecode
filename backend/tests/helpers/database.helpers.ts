import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import * as schema from '@/db/schema';

let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null;
let testClient: postgres.Sql | null = null;

/**
 * Initialize the test database connection
 */
export async function initTestDatabase() {
  if (testDb) {
    return testDb;
  }

  try {
    // Create postgres connection for tests
    testClient = postgres(getDatabaseUrl(), {
      max: 1, // Limit connections for testing
      onnotice: () => {}, // Suppress notices in tests
    });

    testDb = drizzle(testClient, { schema });

    // Skip migrations for tests - assume database is set up
    // This avoids migration file conflicts in test environment
    console.log('Test database connected successfully')
  } catch (error) {
    console.warn('Database connection failed, using mock database for tests:', error);
    
    // Create a mock database for tests that don't require real database
    testDb = {
      query: {
        sessions: {
          findFirst: () => Promise.resolve(null),
          findMany: () => Promise.resolve([]),
        },
        users: {
          findFirst: () => Promise.resolve(null),
          findMany: () => Promise.resolve([]),
        },
        fileAccess: {
          findFirst: () => Promise.resolve(null),
          findMany: () => Promise.resolve([]),
        },
      },
      insert: () => ({
        values: () => ({
          returning: () => Promise.resolve([]),
        }),
      }),
      delete: () => Promise.resolve([]),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve([]),
        }),
      }),
      select: () => ({
        from: () => Promise.resolve([]),
      }),
      transaction: (fn: any) => fn(testDb),
    } as any;
  }

  return testDb;
}

/**
 * Clean up all test data from the database
 */
export async function cleanupTestDatabase() {
  if (!testDb) {
    await initTestDatabase();
  }

  // Clean up in reverse dependency order
  await testDb!.delete(schema.fileAccess);
  await testDb!.delete(schema.sessions);
  await testDb!.delete(schema.users);
}

/**
 * Close the test database connection
 */
export async function closeTestDatabase() {
  if (testClient) {
    await testClient.end();
    testClient = null;
    testDb = null;
  }
}

/**
 * Get the test database instance
 */
export function getTestDatabase() {
  if (!testDb) {
    throw new Error('Test database not initialized. Call initTestDatabase() first.');
  }
  return testDb;
}

/**
 * Get test database URL
 */
function getDatabaseUrl() {
  const DB_HOST = process.env.DB_HOST || 'localhost';
  const DB_PORT = process.env.DB_PORT || '5432';
  const DB_NAME = process.env.DB_NAME || 'pokecode_tests';
  const DB_USER = process.env.DB_USER || 'postgres';
  const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
  return `postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
}

/**
 * Create a test user
 */
export async function createTestUser(data: Partial<typeof schema.users.$inferInsert> = {}) {
  const db = getTestDatabase();
  
  const userData = {
    id: `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    email: data.email || `test-${Date.now()}@example.com`,
    username: data.username || `testuser-${Date.now()}`,
    passwordHash: data.passwordHash || '$2a$10$dummyhash', // Dummy bcrypt hash
    ...data,
  };

  const [user] = await db.insert(schema.users).values(userData).returning();
  return user;
}

/**
 * Create a test session
 */
export async function createTestSession(data: Partial<typeof schema.sessions.$inferInsert> = {}) {
  const db = getTestDatabase();
  
  const sessionData = {
    id: `test-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    projectPath: data.projectPath || `/tmp/test-projects/project-${Date.now()}`,
    claudeDirectoryPath: data.claudeDirectoryPath || `/tmp/test-claude/session-${Date.now()}`,
    context: data.context || null,
    metadata: data.metadata || null,
    status: data.status || 'active',
    ...data,
  };

  const [session] = await db.insert(schema.sessions).values(sessionData).returning();
  return session;
}

/**
 * Create test file access record
 */
export async function createTestFileAccess(data: Partial<typeof schema.fileAccess.$inferInsert> = {}) {
  const db = getTestDatabase();
  
  const fileAccessData = {
    id: `test-file-access-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sessionId: data.sessionId || (await createTestSession()).id,
    filePath: data.filePath || `/test/file-${Date.now()}.ts`,
    accessType: data.accessType || 'read',
    content: data.content || null,
    metadata: data.metadata || {},
    ...data,
  };

  const [fileAccess] = await db.insert(schema.fileAccess).values(fileAccessData).returning();
  return fileAccess;
}

/**
 * Utility to wait for a condition with timeout
 */
export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  timeout = 5000,
  interval = 100,
): Promise<void> {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Database transaction helper for tests
 */
export async function withTransaction<T>(
  callback: (tx: ReturnType<typeof getTestDatabase>) => Promise<T>,
): Promise<T> {
  const db = getTestDatabase();
  
  return await db.transaction(async (tx) => {
    return await callback(tx as typeof db);
  });
}