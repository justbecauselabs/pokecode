import { expect } from 'bun:test';
import { db } from '../src/database';
import { sessions, sessionMessages, jobQueue, type Job } from '../src/database/schema-sqlite';
import { sessionService } from '../src/services/session.service';
import { messageService } from '../src/services/message.service';
import type { Message, UserMessage } from '@pokecode/types';
import { sql } from 'drizzle-orm';

/**
 * Test helper utilities for consistent test setup and assertions
 */

/**
 * Clean all test data from database tables
 * Used between tests to ensure isolation
 */
export async function cleanDatabase(): Promise<void> {
  // Delete in correct order due to foreign keys
  await db.delete(sessionMessages);
  await db.delete(jobQueue);
  await db.delete(sessions);
}

/**
 * Verify database is properly initialized
 * Useful for debugging test setup issues
 */
export async function verifyDatabaseConnection(): Promise<boolean> {
  const result = await db.select({ count: sql<number>`1` }).from(sessions);
  return result !== null;
}

/**
 * Test session factory - creates a test session with default or custom project path
 */
export async function createTestSession(params: { 
  projectPath?: string;
  context?: string;
  metadata?: Record<string, unknown>;
} = {}) {
  const defaultPath = '/Users/test/projects/myapp';
  const session = await sessionService.createSession({ 
    projectPath: params.projectPath ?? defaultPath 
  });
  
  if (params.context || params.metadata) {
    return await sessionService.updateSession(session.id, {
      context: params.context,
      metadata: params.metadata,
    });
  }
  
  return session;
}

/**
 * Create multiple test sessions for pagination/listing tests
 */
export async function createTestSessions(count: number): Promise<string[]> {
  const sessionIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const session = await createTestSession({ 
      projectPath: `/project${i + 1}` 
    });
    sessionIds.push(session.id);
  }
  return sessionIds;
}

/**
 * Create test messages in a session with optional delay between messages
 * to ensure different timestamps
 */
export async function createTestMessages(params: {
  sessionId: string;
  messages: string[];
  delayMs?: number;
}): Promise<void> {
  for (let i = 0; i < params.messages.length; i++) {
    await messageService.saveUserMessage(params.sessionId, params.messages[i]);
    // Add delay between messages to ensure different timestamps
    // This is needed because SQLite timestamp resolution is in seconds
    if (params.delayMs && i < params.messages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, params.delayMs));
    }
  }
}

/**
 * Assert a message is of user type with proper type narrowing
 */
export function assertUserMessage(
  message: Message | undefined,
  expectedContent: string
): asserts message is Message & { type: 'user'; data: UserMessage } {
  expect(message).toBeDefined();
  if (!message) throw new Error('Message is undefined');
  
  expect(message.type).toBe('user');
  if (message.type !== 'user') {
    throw new Error(`Expected user message, got ${message.type}`);
  }
  
  expect(message.data.content).toBe(expectedContent);
}

/**
 * Assert job exists and return it with proper type checking
 */
export function assertJobExists(job: Job | undefined): asserts job is Job {
  expect(job).toBeDefined();
  if (!job) throw new Error('Job should exist');
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  params: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const timeout = params.timeout ?? 5000;
  const interval = params.interval ?? 100;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Create test data helpers
 */
export const testData = {
  projectPaths: {
    simple: '/Users/test/projects/myapp',
    withSpaces: '/Users/test/My Projects/app',
    nested: '/Users/test/projects/monorepo/packages/core',
    root: '/',
  },
  
  contexts: {
    simple: 'Working on authentication',
    detailed: 'Implementing OAuth2 with Google and GitHub providers',
  },
  
  metadata: {
    basic: {
      repository: 'https://github.com/test/repo',
      branch: 'main',
    },
    withTools: {
      repository: 'https://github.com/test/repo',
      branch: 'feature/auth',
      allowedTools: ['read', 'write', 'bash'],
    },
  },
  
  prompts: {
    simple: 'Create a hello world function',
    complex: 'Implement a REST API with authentication',
    withModel: {
      prompt: 'Analyze this code',
      model: 'claude-3-opus',
    },
  },
};

/**
 * Test environment setup and teardown
 */
export const testEnvironment = {
  async setup(): Promise<void> {
    await cleanDatabase();
  },
  
  async teardown(): Promise<void> {
    await cleanDatabase();
  },
};
