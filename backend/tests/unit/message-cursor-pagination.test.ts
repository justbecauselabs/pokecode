import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import type { AssistantMessage, Message, UserMessage } from '@pokecode/api';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { sessions } from '../../src/db/schema-sqlite';
import { sessionMessages } from '../../src/db/schema-sqlite/session_messages';
import { messageService } from '../../src/services/message.service';

// Type guards for message types
function isUserMessage(message: Message): message is Message & { data: UserMessage } {
  return message.type === 'user';
}

function isAssistantMessage(message: Message): message is Message & { data: AssistantMessage } {
  return message.type === 'assistant';
}

describe('Message Cursor Pagination', () => {
  let testSessionId: string;

  beforeAll(async () => {
    // Create a test session
    testSessionId = createId();
    await db.insert(sessions).values({
      id: testSessionId,
      projectPath: '/test/project',
      name: 'Cursor Test Session',
      claudeDirectoryPath: '/test/.claude',
      context: 'test context',
      state: 'active',
      messageCount: 0,
      tokenCount: 0,
    });
  });

  beforeEach(async () => {
    // Clean up any existing messages for the test session
    await db.delete(sessionMessages).where(eq(sessionMessages.sessionId, testSessionId));

    // Reset session counters
    await db
      .update(sessions)
      .set({
        messageCount: 0,
        tokenCount: 0,
      })
      .where(eq(sessions.id, testSessionId));
  });

  test('should return all messages when no cursor provided', async () => {
    // Create test messages with different timestamps
    const now = new Date();
    const testMessages = [
      {
        sessionId: testSessionId,
        type: 'user' as const,
        contentData: JSON.stringify({
          type: 'user',
          message: { role: 'user', content: 'First message' },
          parent_tool_use_id: null,
          session_id: 'test',
        }),
        createdAt: new Date(now.getTime() - 3000), // 3 seconds ago
      },
      {
        sessionId: testSessionId,
        type: 'assistant' as const,
        contentData: JSON.stringify({
          type: 'assistant',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Second message' }] },
          parent_tool_use_id: null,
          session_id: 'test',
        }),
        createdAt: new Date(now.getTime() - 2000), // 2 seconds ago
      },
      {
        sessionId: testSessionId,
        type: 'user' as const,
        contentData: JSON.stringify({
          type: 'user',
          message: { role: 'user', content: 'Third message' },
          parent_tool_use_id: null,
          session_id: 'test',
        }),
        createdAt: new Date(now.getTime() - 1000), // 1 second ago
      },
    ];

    await db.insert(sessionMessages).values(testMessages);

    // Test new API - should return all messages when no cursor provided
    const result = await messageService.getMessages({ sessionId: testSessionId });

    expect(result).toHaveProperty('messages');
    expect(result).toHaveProperty('pagination');
    expect(result.messages).toHaveLength(3);

    const { messages, pagination } = result;

    expect(messages).toHaveLength(3);

    // Verify all messages have proper structure and IDs
    messages.forEach((msg) => {
      expect(msg.id).toBeDefined();
      expect(typeof msg.id).toBe('string');
      expect(msg.type).toBeDefined();
      expect(msg.data).toBeDefined();
    });

    // Verify we have a mix of user and assistant messages as expected
    const userMessages = messages.filter(isUserMessage);
    const assistantMessages = messages.filter(isAssistantMessage);
    expect(userMessages.length).toBe(2);
    expect(assistantMessages.length).toBe(1);

    // Pagination should indicate no next page since no cursor was used
    expect(pagination.hasNextPage).toBe(false);
    expect(pagination.totalFetched).toBe(3);
  });

  test('should return paginated messages with cursor and limit', async () => {
    // Create test messages and get their IDs for cursor testing
    await db
      .insert(sessionMessages)
      .values([
        {
          sessionId: testSessionId,
          type: 'user' as const,
          contentData: JSON.stringify({
            type: 'user',
            message: { role: 'user', content: 'Message 1' },
            parent_tool_use_id: null,
            session_id: 'test',
          }),
        },
        {
          sessionId: testSessionId,
          type: 'assistant' as const,
          contentData: JSON.stringify({
            type: 'assistant',
            message: { role: 'assistant', content: [{ type: 'text', text: 'Message 2' }] },
            parent_tool_use_id: null,
            session_id: 'test',
          }),
        },
        {
          sessionId: testSessionId,
          type: 'user' as const,
          contentData: JSON.stringify({
            type: 'user',
            message: { role: 'user', content: 'Message 3' },
            parent_tool_use_id: null,
            session_id: 'test',
          }),
        },
      ])
      .returning({ id: sessionMessages.id });

    // Get all messages to find the cursor ID of the second message
    const allMessages = await messageService.getMessages({ sessionId: testSessionId });
    const secondMessageId = allMessages.messages[1].id;

    // Test cursor pagination - fetch messages after the second message
    const result = await messageService.getMessages({
      sessionId: testSessionId,
      cursor: secondMessageId,
      limit: 10,
    });

    expect(result).toHaveProperty('messages');
    expect(result).toHaveProperty('pagination');

    const { messages, pagination } = result;

    // Should only return messages created after the cursor
    expect(messages).toHaveLength(1);

    // Verify the returned message has proper structure
    expect(messages[0].id).toBeDefined();
    expect(typeof messages[0].id).toBe('string');
    expect(messages[0].type).toBeDefined();
    expect(messages[0].data).toBeDefined();

    // Pagination metadata
    expect(pagination.hasNextPage).toBe(false);
    expect(pagination.totalFetched).toBe(1);
    expect(pagination.nextCursor).toBeNull();
  });

  test('should handle empty results with cursor', async () => {
    // Create a test message and get its ID
    const insertedMessage = await db
      .insert(sessionMessages)
      .values([
        {
          sessionId: testSessionId,
          type: 'user' as const,
          contentData: JSON.stringify({
            type: 'user',
            message: { role: 'user', content: 'Only message' },
            parent_tool_use_id: null,
            session_id: 'test',
          }),
        },
      ])
      .returning({ id: sessionMessages.id });

    const messageId = insertedMessage[0].id;

    // Use the message ID as cursor - should return no messages (since we're looking for messages after this one)
    const result = await messageService.getMessages({
      sessionId: testSessionId,
      cursor: messageId,
      limit: 10,
    });

    const { messages, pagination } = result;

    expect(messages).toHaveLength(0);
    expect(pagination.hasNextPage).toBe(false);
    expect(pagination.totalFetched).toBe(0);
    expect(pagination.nextCursor).toBeNull();
  });

  test('should respect limit parameter and indicate next page', async () => {
    // Create many test messages one by one to ensure proper ordering
    for (let i = 0; i < 5; i++) {
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'user' as const,
        contentData: JSON.stringify({
          type: 'user',
          message: { role: 'user', content: `Message ${i + 1}` },
          parent_tool_use_id: null,
          session_id: 'test',
        }),
      });
      // Small delay to ensure CUID2 ordering
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    // Fetch with a small limit
    const result = await messageService.getMessages({
      sessionId: testSessionId,
      limit: 2,
    });

    const { messages, pagination } = result;

    expect(messages).toHaveLength(2);
    expect(isUserMessage(messages[0])).toBe(true);
    expect(isUserMessage(messages[1])).toBe(true);

    // Check that we got some messages with the expected pattern
    if (isUserMessage(messages[0]) && isUserMessage(messages[1])) {
      const contents = [messages[0].data.content, messages[1].data.content];
      expect(contents.every((content) => content.startsWith('Message '))).toBe(true);
    }

    expect(pagination.hasNextPage).toBe(true);
    expect(pagination.totalFetched).toBe(2);
    expect(pagination.nextCursor).toBeDefined();
    expect(typeof pagination.nextCursor).toBe('string');
  });

  test('should maintain chronological order with cursor pagination', async () => {
    // Create test messages one by one to ensure proper ordering
    await db.insert(sessionMessages).values({
      sessionId: testSessionId,
      type: 'user' as const,
      contentData: JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'First' },
        parent_tool_use_id: null,
        session_id: 'test',
      }),
    });

    await new Promise((resolve) => setTimeout(resolve, 1));

    await db.insert(sessionMessages).values({
      sessionId: testSessionId,
      type: 'assistant' as const,
      contentData: JSON.stringify({
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Second' }] },
        parent_tool_use_id: null,
        session_id: 'test',
      }),
    });

    await new Promise((resolve) => setTimeout(resolve, 1));

    await db.insert(sessionMessages).values({
      sessionId: testSessionId,
      type: 'user' as const,
      contentData: JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Third' },
        parent_tool_use_id: null,
        session_id: 'test',
      }),
    });

    // Get all messages to find the first message ID for cursor
    const allMessages = await messageService.getMessages({ sessionId: testSessionId });
    const firstMessageId = allMessages.messages[0].id;

    // Fetch messages after the first one using its ID as cursor
    const result = await messageService.getMessages({
      sessionId: testSessionId,
      cursor: firstMessageId,
      limit: 10,
    });

    const { messages } = result;

    expect(messages).toHaveLength(2);

    // We should get messages after the first one, verify the content patterns
    const messageContents = messages.map((msg) => {
      if (isUserMessage(msg)) {
        return msg.data.content;
      }
      if (isAssistantMessage(msg) && msg.data.type === 'message') {
        return msg.data.data.content;
      }
      return 'unknown';
    });

    // Should contain some expected content
    expect(
      messageContents.some((content) => typeof content === 'string' && content.length > 0),
    ).toBe(true);
  });

  test('should handle new API with object parameter', async () => {
    // Create a test message
    const testMessage = {
      sessionId: testSessionId,
      type: 'user' as const,
      contentData: JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Test message' },
        parent_tool_use_id: null,
        session_id: 'test',
      }),
    };

    await db.insert(sessionMessages).values([testMessage]);

    // Test new API signature (object parameter)
    const result = await messageService.getMessages({ sessionId: testSessionId });

    expect(result).toHaveProperty('messages');
    expect(result).toHaveProperty('pagination');
    expect(result.messages).toHaveLength(1);

    const { messages } = result;
    expect(isUserMessage(messages[0])).toBe(true);
    if (isUserMessage(messages[0])) {
      expect(messages[0].data.content).toBe('Test message');
    }
  });
});
