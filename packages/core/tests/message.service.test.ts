import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../src/database';
import { jobQueue, sessionMessages, sessions } from '../src/database/schema-sqlite';
import { messageService } from '../src/services/message.service';
import { assistantTextMessage, createAssistantMessage, createUserMessage } from './sdk-fixtures';
import {
  assertJobExists,
  assertUserMessage,
  createTestMessages,
  createTestSession,
  testData,
  testEnvironment,
} from './test-setup';

describe('MessageService Integration Tests', () => {
  let sessionId: string;

  beforeEach(async () => {
    await testEnvironment.setup();
    // Create a test session for message operations
    const session = await createTestSession({
      projectPath: testData.projectPaths.simple,
    });
    sessionId = session.id;
  });

  afterEach(async () => {
    await testEnvironment.teardown();
  });

  describe('queuePrompt', () => {
    it('should queue a prompt for processing', async () => {
      const prompt = 'Create a hello world function';

      await messageService.queuePrompt(sessionId, prompt);

      // Verify job was created in queue
      const jobs = await db.select().from(jobQueue).where(eq(jobQueue.sessionId, sessionId));
      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toMatchObject({
        sessionId,
        status: 'pending',
        attempts: 0,
        maxAttempts: 1,
      });

      const job = jobs[0];
      assertJobExists(job);

      expect(job.data.prompt).toBe(prompt);
      expect(job.data.projectPath).toBe(testData.projectPaths.simple);
    });

    it('should queue prompt with custom model', async () => {
      const prompt = 'Analyze this code';
      const model = 'claude-3-opus';

      await messageService.queuePrompt(sessionId, prompt, model);

      const jobs = await db.select().from(jobQueue).where(eq(jobQueue.sessionId, sessionId));
      const job = jobs[0];
      assertJobExists(job);

      expect(job.data.model).toBe(model);
    });

    it('should update session working state when queueing', async () => {
      await messageService.queuePrompt(sessionId, 'Test prompt');

      const session = await db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
      expect(session?.isWorking).toBe(true);
      expect(session?.currentJobId).toBeString();
    });
  });

  describe('saveSDKMessage', () => {
    it('should save user message from SDK format', async () => {
      const sdkMessage = createUserMessage('Hello Claude!', 'sdk-123');

      await messageService.saveSDKMessage({ sessionId, sdkMessage, providerSessionId: 'sdk-123' });

      // Verify message was saved
      const messages = await db
        .select()
        .from(sessionMessages)
        .where(eq(sessionMessages.sessionId, sessionId));
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        sessionId,
        type: 'user',
        providerSessionId: 'sdk-123',
      });

      // Verify content is stored as JSON
      const content = JSON.parse(messages[0]?.contentData || '{}');
      expect(content.type).toBe('user');
      expect(content.message.content).toBe('Hello Claude!');
    });

    it('should save assistant message with token count', async () => {
      await messageService.saveSDKMessage({ sessionId, sdkMessage: assistantTextMessage, providerSessionId: 'sdk-123' });

      const messages = await db
        .select()
        .from(sessionMessages)
        .where(eq(sessionMessages.sessionId, sessionId));
      expect(messages[0]?.type).toBe('assistant');
      expect(messages[0]?.tokenCount).toBe(75); // 25 input + 50 output from fixture
    });

    it('should update session message and token counts', async () => {
      const sdkMessage = createAssistantMessage('Response text', { input: 100, output: 200 });

      await messageService.saveSDKMessage({ sessionId, sdkMessage });

      const session = await db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
      expect(session?.messageCount).toBe(1);
      expect(session?.tokenCount).toBe(300);

      // Save another message
      await messageService.saveSDKMessage({ sessionId, sdkMessage });

      const updatedSession = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .get();
      expect(updatedSession?.messageCount).toBe(2);
      expect(updatedSession?.tokenCount).toBe(600);
    });
  });

  describe('saveUserMessage', () => {
    it('should save user message in SDK format', async () => {
      const content = 'What is the weather today?';

      await messageService.saveUserMessage(sessionId, content);

      const messages = await db
        .select()
        .from(sessionMessages)
        .where(eq(sessionMessages.sessionId, sessionId));
      expect(messages).toHaveLength(1);
      expect(messages[0]?.type).toBe('user');

      const savedContent = JSON.parse(messages[0]?.contentData || '{}');
      expect(savedContent.type).toBe('user');
      expect(savedContent.message.role).toBe('user');
      expect(savedContent.message.content).toBe(content);
    });

    it('should increment message count but not token count for user messages', async () => {
      await messageService.saveUserMessage(sessionId, 'Test message');

      const session = await db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
      expect(session?.messageCount).toBe(1);
      expect(session?.tokenCount).toBe(0); // User messages don't have token cost
    });
  });

  describe('getMessages', () => {
    beforeEach(async () => {
      // Create test messages sequentially
      // Messages are ordered by createdAt then by ID for stable ordering
      await createTestMessages({
        sessionId,
        messages: ['First message', 'Second message', 'Third message'],
        delayMs: 1001, // Ensure different timestamp seconds in SQLite
      });
    });

    it('should retrieve messages for a session', async () => {
      const result = await messageService.getMessages({
        sessionId,
        projectPath: testData.projectPaths.simple,
      });

      expect(result.messages).toHaveLength(3);
      expect(result.pagination.totalFetched).toBe(3);
      expect(result.pagination.hasNextPage).toBe(false);
    });

    it('should support pagination with limit', async () => {
      const result = await messageService.getMessages({
        sessionId,
        projectPath: testData.projectPaths.simple,
        limit: 2,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.nextCursor).toBeString();
    });

    it('should support cursor-based pagination', async () => {
      // Get first page
      const page1 = await messageService.getMessages({
        sessionId,
        projectPath: testData.projectPaths.simple,
        limit: 2,
      });

      expect(page1.messages).toHaveLength(2);

      // Get second page using cursor
      const page2 = await messageService.getMessages({
        sessionId,
        projectPath: testData.projectPaths.simple,
        cursor: page1.pagination.nextCursor ?? undefined,
        limit: 2,
      });

      expect(page2.messages).toHaveLength(1);
      expect(page2.pagination.hasNextPage).toBe(false);

      // Verify different messages
      expect(page1.messages[0]?.id).not.toBe(page2.messages[0]?.id);
    });

    it('should return messages in chronological order', async () => {
      const result = await messageService.getMessages({
        sessionId,
        projectPath: testData.projectPaths.simple,
      });

      // Messages should be in the order they were created
      expect(result.messages).toHaveLength(3);

      // Use the assertUserMessage helper for proper type checking
      assertUserMessage(result.messages[0], 'First message');
      assertUserMessage(result.messages[1], 'Second message');
      assertUserMessage(result.messages[2], 'Third message');
    });
  });

  describe('getLastProviderSessionId', () => {
    it('should return null when no messages have Claude session ID', async () => {
      await messageService.saveUserMessage(sessionId, 'Test');

      const claudeSessionId = await messageService.getLastProviderSessionId(sessionId);
      expect(claudeSessionId).toBeNull();
    });

    it.skip('should return the most recent Claude session ID', async () => {
      // Save messages with different Claude session IDs
      const msg1 = createUserMessage('First message', 'claude-session-1');
      const msg2 = createUserMessage('Second message', 'claude-session-2');

      await messageService.saveSDKMessage({ sessionId, sdkMessage: msg1, providerSessionId: 'claude-session-1' });

      // Wait longer to ensure different timestamp in milliseconds
      await new Promise((resolve) => setTimeout(resolve, 50));

      await messageService.saveSDKMessage({ sessionId, sdkMessage: msg2, providerSessionId: 'claude-session-2' });

      const claudeSessionId = await messageService.getLastProviderSessionId(sessionId);
      expect(claudeSessionId).toBe('claude-session-2');
    });
  });

  describe('getRawMessages', () => {
    it('should return messages with parsed SDK content', async () => {
      const sdkMessage = createUserMessage('Test message', 'test-session');

      await messageService.saveSDKMessage({ sessionId, sdkMessage, providerSessionId: 'test-session' });

      const rawMessages = await messageService.getRawMessages(sessionId);
      expect(rawMessages).toHaveLength(1);
      expect(rawMessages[0]?.contentData).toMatchObject({
        type: 'user',
        message: { role: 'user', content: 'Test message' },
      });
      expect(rawMessages[0]?.providerSessionId).toBe('test-session');
    });
  });

  describe('cancelSession', () => {
    it('should cancel pending jobs for session', async () => {
      // Queue multiple prompts
      await messageService.queuePrompt(sessionId, 'Prompt 1');
      await messageService.queuePrompt(sessionId, 'Prompt 2');

      // Verify jobs are pending
      const jobsBefore = await db.select().from(jobQueue).where(eq(jobQueue.sessionId, sessionId));
      expect(jobsBefore.filter((j) => j.status === 'pending')).toHaveLength(2);

      // Cancel session
      await messageService.cancelSession(sessionId);

      // Verify jobs are cancelled
      const jobsAfter = await db.select().from(jobQueue).where(eq(jobQueue.sessionId, sessionId));
      expect(jobsAfter.filter((j) => j.status === 'cancelled')).toHaveLength(2);
    });

    it('should update session state when cancelling', async () => {
      await messageService.queuePrompt(sessionId, 'Test prompt');

      await messageService.cancelSession(sessionId);

      const session = await db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
      expect(session?.isWorking).toBe(false);
      expect(session?.currentJobId).toBeNull();
      expect(session?.lastJobStatus).toBe('cancelled');
    });

    it('should handle cancelling non-working session gracefully', async () => {
      // Don't queue any prompts - session is not working
      await messageService.cancelSession(sessionId);

      // Should complete without error
      const session = await db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
      expect(session?.isWorking).toBe(false);
    });
  });
});
