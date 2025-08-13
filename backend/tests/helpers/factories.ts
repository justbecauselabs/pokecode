import * as schema from '@/db/schema';
import { getTestDatabase } from './database.helpers';

/**
 * Factory functions for creating test data with realistic defaults
 */

export interface UserFactoryOptions extends Partial<typeof schema.users.$inferInsert> {}
export interface SessionFactoryOptions extends Partial<typeof schema.sessions.$inferInsert> {}
export interface FileAccessFactoryOptions extends Partial<typeof schema.fileAccess.$inferInsert> {}

/**
 * Generate a unique test identifier
 */
export function generateTestId(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a realistic email address for testing
 */
export function generateTestEmail(prefix = 'test'): string {
  return `${prefix}-${Date.now()}@example.com`;
}

/**
 * Generate a realistic username for testing
 */
export function generateTestUsername(prefix = 'user'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Create a test user with realistic defaults
 */
export async function createUser(options: UserFactoryOptions = {}): Promise<typeof schema.users.$inferSelect> {
  const db = getTestDatabase();
  
  const userData = {
    id: options.id || generateTestId('user'),
    email: options.email || generateTestEmail(),
    username: options.username || generateTestUsername(),
    passwordHash: options.passwordHash || '$2a$10$defaulthashfortesting',
    createdAt: options.createdAt || new Date(),
    updatedAt: options.updatedAt || new Date(),
    ...options,
  };

  const [user] = await db.insert(schema.users).values(userData).returning();
  return user;
}

/**
 * Create a test session with realistic defaults
 */
export async function createSession(options: SessionFactoryOptions = {}): Promise<typeof schema.sessions.$inferSelect> {
  const db = getTestDatabase();
  
  const sessionData = {
    id: options.id || generateTestId('session'),
    projectPath: options.projectPath || `/tmp/test-projects/project-${Date.now()}`,
    claudeDirectoryPath: options.claudeDirectoryPath || `/tmp/test-claude/session-${Date.now()}`,
    context: options.context || null,
    metadata: options.metadata || null,
    isWorking: options.isWorking || false,
    currentJobId: options.currentJobId || null,
    lastJobStatus: options.lastJobStatus || null,
    createdAt: options.createdAt || new Date(),
    updatedAt: options.updatedAt || new Date(),
    lastAccessedAt: options.lastAccessedAt || new Date(),
    ...options,
  };

  const [session] = await db.insert(schema.sessions).values(sessionData).returning();
  return session;
}

/**
 * Create a test file access record with realistic defaults
 */
export async function createFileAccess(options: FileAccessFactoryOptions = {}): Promise<typeof schema.fileAccess.$inferSelect> {
  const db = getTestDatabase();
  
  // Create a session if sessionId is not provided
  let sessionId = options.sessionId;
  if (!sessionId) {
    const session = await createSession();
    sessionId = session.id;
  }
  
  const fileAccessData = {
    id: options.id || generateTestId('file-access'),
    sessionId,
    filePath: options.filePath || `/test/file-${Date.now()}.ts`,
    accessType: options.accessType || 'read',
    content: options.content || null,
    metadata: options.metadata || {},
    createdAt: options.createdAt || new Date(),
    ...options,
  };

  const [fileAccess] = await db.insert(schema.fileAccess).values(fileAccessData).returning();
  return fileAccess;
}

/**
 * Create multiple sessions for testing pagination and filtering
 */
export async function createMultipleSessions(count: number, baseOptions: SessionFactoryOptions = {}): Promise<Array<typeof schema.sessions.$inferSelect>> {
  const sessions = [];
  
  for (let i = 0; i < count; i++) {
    const session = await createSession({
      ...baseOptions,
      projectPath: baseOptions.projectPath || `/tmp/test-projects/project-${i}`,
      context: baseOptions.context || `Test session ${i}`,
      metadata: { ...baseOptions.metadata, index: i },
    });
    sessions.push(session);
  }
  
  return sessions;
}

/**
 * Create a session with related file access records
 */
export async function createSessionWithFiles(
  sessionOptions: SessionFactoryOptions = {},
  fileCount = 3
): Promise<{
  session: typeof schema.sessions.$inferSelect;
  files: Array<typeof schema.fileAccess.$inferSelect>;
}> {
  const session = await createSession(sessionOptions);
  const files = [];
  
  for (let i = 0; i < fileCount; i++) {
    const file = await createFileAccess({
      sessionId: session.id,
      filePath: `/test/file-${i}.ts`,
      accessType: i % 2 === 0 ? 'read' : 'write',
      content: i % 2 === 1 ? `console.log('File ${i}');` : null,
    });
    files.push(file);
  }
  
  return { session, files };
}

/**
 * Create test data for different session statuses
 */
export async function createSessionsWithVariousStatuses(): Promise<{
  active: Array<typeof schema.sessions.$inferSelect>;
  inactive: Array<typeof schema.sessions.$inferSelect>;
  archived: Array<typeof schema.sessions.$inferSelect>;
}> {
  const [active1, active2] = await Promise.all([
    createSession({ status: 'active', projectPath: '/test/active1' }),
    createSession({ status: 'active', projectPath: '/test/active2' }),
  ]);
  
  const [inactive1, inactive2] = await Promise.all([
    createSession({ status: 'inactive', projectPath: '/test/inactive1' }),
    createSession({ status: 'inactive', projectPath: '/test/inactive2' }),
  ]);
  
  const [archived1] = await Promise.all([
    createSession({ status: 'archived', projectPath: '/test/archived1' }),
  ]);
  
  return {
    active: [active1, active2],
    inactive: [inactive1, inactive2],
    archived: [archived1],
  };
}

/**
 * Create realistic project path for testing
 */
export function createTestProjectPath(projectName?: string): string {
  const name = projectName || `project-${Date.now()}`;
  return `/tmp/test-projects/${name}`;
}

/**
 * Create realistic Claude directory path for testing
 */
export function createTestClaudeDirectoryPath(sessionId?: string): string {
  const id = sessionId || generateTestId('session');
  return `/tmp/test-claude/${id}`;
}

/**
 * Create test prompt job data
 */
export function createTestPromptJobData(options: Partial<{
  sessionId: string;
  promptId: string;
  prompt: string;
  allowedTools: string[];
  projectPath: string;
}> = {}): {
  sessionId: string;
  promptId: string;
  prompt: string;
  allowedTools?: string[];
  projectPath: string;
} {
  return {
    sessionId: options.sessionId || generateTestId('session'),
    promptId: options.promptId || generateTestId('prompt'),
    prompt: options.prompt || 'Write a hello world function in TypeScript',
    allowedTools: options.allowedTools || ['read', 'write'],
    projectPath: options.projectPath || createTestProjectPath(),
  };
}

/**
 * Create test file content for various file types
 */
export const testFileContents = {
  typescript: `
interface User {
  id: string;
  name: string;
  email: string;
}

export function createUser(userData: Partial<User>): User {
  return {
    id: generateId(),
    name: userData.name || 'Unknown',
    email: userData.email || 'unknown@example.com',
  };
}
  `.trim(),
  
  javascript: `
function calculateSum(numbers) {
  return numbers.reduce((sum, num) => sum + num, 0);
}

module.exports = { calculateSum };
  `.trim(),
  
  json: JSON.stringify({
    name: 'test-package',
    version: '1.0.0',
    scripts: {
      test: 'vitest',
      build: 'tsc',
    },
    dependencies: {
      typescript: '^5.0.0',
    },
  }, null, 2),
  
  markdown: `
# Test Project

This is a test project for testing purposes.

## Features

- Feature 1
- Feature 2
- Feature 3

## Installation

\`\`\`bash
npm install
\`\`\`
  `.trim(),
  
  css: `
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.button {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}
  `.trim(),
};

/**
 * Create test metadata objects
 */
export const testMetadata = {
  session: {
    basic: { version: '1.0.0', environment: 'test' },
    withBranch: { version: '1.0.0', branch: 'main', commit: 'abc123' },
    withFeatures: { version: '2.0.0', features: ['feature1', 'feature2'] },
  },
  
  fileAccess: {
    basic: { encoding: 'utf-8', size: 1024 },
    withMimeType: { encoding: 'utf-8', mimeType: 'application/typescript', size: 2048 },
    withChecksum: { encoding: 'utf-8', checksum: 'sha256:abc123', size: 512 },
  },
  
  prompt: {
    basic: { model: 'claude-3-5-sonnet-20241022', temperature: 0.7 },
    withTools: { 
      model: 'claude-3-5-sonnet-20241022', 
      temperature: 0.7,
      toolsUsed: ['read', 'write'],
      tokenCount: 150,
    },
    withTiming: {
      model: 'claude-3-5-sonnet-20241022',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 5000).toISOString(),
      duration: 5000,
    },
  },
};

/**
 * Clean up test data (useful for specific test cleanup)
 */
export async function cleanupTestData(options: {
  userIds?: string[];
  sessionIds?: string[];
  fileAccessIds?: string[];
} = {}) {
  const db = getTestDatabase();
  
  if (options.fileAccessIds?.length) {
    await db.delete(schema.fileAccess).where(
      schema.fileAccess.id.in(options.fileAccessIds)
    );
  }
  
  if (options.sessionIds?.length) {
    await db.delete(schema.sessions).where(
      schema.sessions.id.in(options.sessionIds)
    );
  }
  
  if (options.userIds?.length) {
    await db.delete(schema.users).where(
      schema.users.id.in(options.userIds)
    );
  }
}