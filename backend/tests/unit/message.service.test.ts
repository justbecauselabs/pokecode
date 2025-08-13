import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { sessionMessages, sessions } from '@/db/schema';
import { messageService } from '@/services/message.service';
import type { JsonlMessage } from '@/types/claude-messages';

// Test data
const mockJsonlMessages: JsonlMessage[] = [
  {
    uuid: 'msg-1',
    parentUuid: null,
    sessionId: 'claude-session-1',
    timestamp: '2025-01-01T10:00:00Z',
    type: 'user',
    isSidechain: false,
    userType: 'external',
    cwd: '/test/project',
    version: '1.0.0',
    gitBranch: 'main',
    message: {
      role: 'user',
      content: 'Hello, Claude!'
    }
  },
  {
    uuid: 'msg-2',
    parentUuid: 'msg-1',
    sessionId: 'claude-session-1',
    timestamp: '2025-01-01T10:01:00Z',
    type: 'assistant',
    isSidechain: false,
    userType: 'external',
    cwd: '/test/project',
    version: '1.0.0',
    gitBranch: 'main',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Hello! How can I help you today?'
        }
      ],
      id: 'msg_test_123',
      type: 'message',
      model: 'claude-3-sonnet-20240229',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        cache_read_input_tokens: 0,
        output_tokens: 15
      }
    }
  }
];

describe('MessageService', () => {
  let testSessionId: string;

  beforeEach(async () => {
    // Create a test session
    const sessionResult = await db.insert(sessions).values({
      projectPath: '/test/project',
      claudeDirectoryPath: '/test/.claude',
      metadata: {},
    }).returning();

    testSessionId = sessionResult[0]!.id;
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(sessionMessages).where(eq(sessionMessages.sessionId, testSessionId));
    await db.delete(sessions).where(eq(sessions.id, testSessionId));
  });

  describe('createMessage', () => {
    it('should create a user message successfully', async () => {
      const content = 'Test message content';
      
      const result = await messageService.createMessage(testSessionId, content);

      expect(result).toMatchObject({
        sessionId: testSessionId,
        role: 'user',
        content,
        children: []
      });
      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('saveAssistantMessageWithData', () => {
    it('should save assistant message with JSONB content data', async () => {
      const content = 'Assistant response';
      
      const result = await messageService.saveAssistantMessageWithData(
        testSessionId,
        content,
        mockJsonlMessages
      );

      expect(result).toMatchObject({
        sessionId: testSessionId,
        text: content,
        type: 'assistant',
        contentData: mockJsonlMessages
      });
      expect(result.id).toBeDefined();
    });

    it('should save assistant message without JSONB data when not provided', async () => {
      const content = 'Assistant response';
      
      const result = await messageService.saveAssistantMessageWithData(
        testSessionId,
        content
      );

      expect(result).toMatchObject({
        sessionId: testSessionId,
        text: content,
        type: 'assistant',
        contentData: null
      });
    });
  });

  describe('updateMessageContentData', () => {
    it('should update message with JSONB content data', async () => {
      // First create a message
      const messageResult = await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        text: 'Test message',
        type: 'user'
      }).returning();

      const messageId = messageResult[0]!.id;

      // Update with JSONB content
      await messageService.updateMessageContentData(messageId, mockJsonlMessages);

      // Verify the update
      const updatedMessage = await messageService.getMessageById(messageId);
      expect(updatedMessage?.contentData).toEqual(mockJsonlMessages);
    });
  });

  describe('getMessages', () => {
    it('should return messages with JSONB content converted to children', async () => {
      // Create a user message
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        text: 'User message',
        type: 'user'
      });

      // Create an assistant message with JSONB content
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        text: 'Assistant message',
        type: 'assistant',
        contentData: mockJsonlMessages
      });

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(2);
      
      // Check user message
      const userMessage = messages[0]!;
      expect(userMessage.role).toBe('user');
      expect(userMessage.content).toBe('User message');
      expect(userMessage.children).toEqual([]);

      // Check assistant message with JSONB content
      const assistantMessage = messages[1]!;
      expect(assistantMessage.role).toBe('assistant');
      expect(assistantMessage.content).toBe('Assistant message');
      expect(assistantMessage.children).toHaveLength(2);
      expect(assistantMessage.children[0]).toMatchObject({
        id: 'msg-1',
        role: 'user',
        content: 'Hello, Claude!'
      });
      expect(assistantMessage.children[1]).toMatchObject({
        id: 'msg-2',
        role: 'assistant',
        content: 'Hello! How can I help you today?'
      });
    });

    it('should return empty children array when no JSONB content', async () => {
      // Create a message without JSONB content
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        text: 'Simple message',
        type: 'user'
      });

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(1);
      expect(messages[0]!.children).toEqual([]);
    });

    it('should handle invalid JSONB content gracefully', async () => {
      // Create a message with invalid JSONB content
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        text: 'Message with invalid JSONB',
        type: 'assistant',
        contentData: [{ invalid: 'data' }] as any
      });

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(1);
      expect(messages[0]!.children).toEqual([]);
    });
  });

  describe('JSONB indexing and querying', () => {
    it('should support querying JSONB content', async () => {
      // Create a message with JSONB content
      const messageResult = await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        text: 'Test message',
        type: 'assistant',
        contentData: mockJsonlMessages
      }).returning();

      const messageId = messageResult[0]!.id;

      // Query the message by JSONB content
      const foundMessages = await db
        .select()
        .from(sessionMessages)
        .where(eq(sessionMessages.id, messageId));

      expect(foundMessages).toHaveLength(1);
      expect(foundMessages[0]!.contentData).toEqual(mockJsonlMessages);
    });

    it('should handle empty JSONB arrays', async () => {
      const messageResult = await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        text: 'Empty JSONB message',
        type: 'assistant',
        contentData: []
      }).returning();

      const messageId = messageResult[0]!.id;
      const message = await messageService.getMessageById(messageId);
      
      expect(message?.contentData).toEqual([]);
    });

    it('should handle null JSONB content', async () => {
      const messageResult = await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        text: 'Null JSONB message',
        type: 'assistant',
        contentData: null
      }).returning();

      const messageId = messageResult[0]!.id;
      const message = await messageService.getMessageById(messageId);
      
      expect(message?.contentData).toBe(null);
    });
  });

  describe('backward compatibility', () => {
    it('should maintain backward compatibility with claudeSessionId field', async () => {
      // Create a message with legacy claudeSessionId
      const messageResult = await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        text: 'Legacy message',
        type: 'user',
        claudeSessionId: 'legacy-session-id'
      }).returning();

      const messageId = messageResult[0]!.id;

      // Update the claudeSessionId
      await messageService.updateClaudeSessionId(messageId, 'updated-session-id');

      const updatedMessage = await messageService.getMessageById(messageId);
      expect(updatedMessage?.claudeSessionId).toBe('updated-session-id');
    });

    it('should handle messages with both claudeSessionId and contentData', async () => {
      const messageResult = await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        text: 'Hybrid message',
        type: 'assistant',
        claudeSessionId: 'legacy-session-id',
        contentData: mockJsonlMessages
      }).returning();

      const messages = await messageService.getMessages(testSessionId);
      
      expect(messages).toHaveLength(1);
      expect(messages[0]!.claudeSessionId).toBe('legacy-session-id');
      expect(messages[0]!.children).toHaveLength(2); // From JSONB contentData
    });
  });
});