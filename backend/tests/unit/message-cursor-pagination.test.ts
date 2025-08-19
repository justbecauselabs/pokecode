import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { sessions } from '../../src/db/schema-sqlite';
import { sessionMessages } from '../../src/db/schema-sqlite/session_messages';
import { messageService } from '../../src/services/message.service';

describe('Message Cursor Pagination', () => {
  let testSessionId: string;

  beforeAll(async () => {
    // Create a test session
    testSessionId = globalThis.crypto.randomUUID();
    await db.insert(sessions).values({
      id: testSessionId,
      projectPath: '/test/project',
      name: 'Cursor Test Session',
      claudeDirectoryPath: '/test/.claude',
      context: 'test context',
      status: 'active',
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
    // User message - data.content
    expect(messages[0].data.content).toBe('First message');
    // Assistant message - data.data.content
    expect(messages[1].data.data.content).toBe('Second message');
    // User message - data.content
    expect(messages[2].data.content).toBe('Third message');

    // Pagination should indicate no next page since no cursor was used
    expect(pagination.hasNextPage).toBe(false);
    expect(pagination.totalFetched).toBe(3);
  });

  test('should return paginated messages with cursor and limit', async () => {
    // Create test messages with different timestamps
    const now = new Date();
    const testMessages = [
      {
        sessionId: testSessionId,
        type: 'user' as const,
        contentData: JSON.stringify({
          type: 'user',
          message: { role: 'user', content: 'Message 1' },
          parent_tool_use_id: null,
          session_id: 'test',
        }),
        createdAt: new Date(now.getTime() - 5000), // 5 seconds ago
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
        createdAt: new Date(now.getTime() - 4000), // 4 seconds ago
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
        createdAt: new Date(now.getTime() - 2000), // 2 seconds ago
      },
    ];

    await db.insert(sessionMessages).values(testMessages);

    // Test cursor pagination - fetch messages after the second message
    const cursorTime = new Date(now.getTime() - 3000).toISOString(); // 3 seconds ago
    const result = await messageService.getMessages({
      sessionId: testSessionId,
      cursor: cursorTime,
      limit: 10,
    });

    expect(result).toHaveProperty('messages');
    expect(result).toHaveProperty('pagination');

    const { messages, pagination } = result as any;

    // Should only return messages created after the cursor
    expect(messages).toHaveLength(1);
    expect(messages[0].data.content).toBe('Message 3');

    // Pagination metadata
    expect(pagination.hasNextPage).toBe(false);
    expect(pagination.totalFetched).toBe(1);
    expect(pagination.nextCursor).toBeNull();
  });

  test('should handle empty results with cursor', async () => {
    // Create test messages in the past
    const now = new Date();
    const testMessages = [
      {
        sessionId: testSessionId,
        type: 'user' as const,
        contentData: JSON.stringify({
          type: 'user',
          message: { role: 'user', content: 'Old message' },
          parent_tool_use_id: null,
          session_id: 'test',
        }),
        createdAt: new Date(now.getTime() - 5000), // 5 seconds ago
      },
    ];

    await db.insert(sessionMessages).values(testMessages);

    // Use a cursor from the future - should return no messages
    const futureCursor = new Date(now.getTime() + 1000).toISOString(); // 1 second in future
    const result = await messageService.getMessages({
      sessionId: testSessionId,
      cursor: futureCursor,
      limit: 10,
    });

    const { messages, pagination } = result as any;

    expect(messages).toHaveLength(0);
    expect(pagination.hasNextPage).toBe(false);
    expect(pagination.totalFetched).toBe(0);
    expect(pagination.nextCursor).toBeNull();
  });

  test('should respect limit parameter and indicate next page', async () => {
    // Create many test messages
    const now = new Date();
    const testMessages = [];

    for (let i = 0; i < 5; i++) {
      testMessages.push({
        sessionId: testSessionId,
        type: 'user' as const,
        contentData: JSON.stringify({
          type: 'user',
          message: { role: 'user', content: `Message ${i + 1}` },
          parent_tool_use_id: null,
          session_id: 'test',
        }),
        createdAt: new Date(now.getTime() - (5000 - i * 1000)), // Spread over 5 seconds
      });
    }

    await db.insert(sessionMessages).values(testMessages);

    // Fetch with a small limit
    const result = await messageService.getMessages({
      sessionId: testSessionId,
      limit: 2,
    });

    const { messages, pagination } = result as any;

    expect(messages).toHaveLength(2);
    expect(messages[0].data.content).toBe('Message 1');
    expect(messages[1].data.content).toBe('Message 2');

    expect(pagination.hasNextPage).toBe(true);
    expect(pagination.totalFetched).toBe(2);
    expect(pagination.nextCursor).toBeDefined();
    expect(typeof pagination.nextCursor).toBe('string');
  });

  test('should maintain chronological order with cursor pagination', async () => {
    // Create test messages with specific timestamps
    const baseTime = new Date('2023-01-01T00:00:00Z');
    const testMessages = [
      {
        sessionId: testSessionId,
        type: 'user' as const,
        contentData: JSON.stringify({
          type: 'user',
          message: { role: 'user', content: 'First' },
          parent_tool_use_id: null,
          session_id: 'test',
        }),
        createdAt: new Date(baseTime.getTime() + 1000),
      },
      {
        sessionId: testSessionId,
        type: 'assistant' as const,
        contentData: JSON.stringify({
          type: 'assistant',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Second' }] },
          parent_tool_use_id: null,
          session_id: 'test',
        }),
        createdAt: new Date(baseTime.getTime() + 2000),
      },
      {
        sessionId: testSessionId,
        type: 'user' as const,
        contentData: JSON.stringify({
          type: 'user',
          message: { role: 'user', content: 'Third' },
          parent_tool_use_id: null,
          session_id: 'test',
        }),
        createdAt: new Date(baseTime.getTime() + 3000),
      },
    ];

    await db.insert(sessionMessages).values(testMessages);

    // Fetch messages after the first one
    const cursor = new Date(baseTime.getTime() + 1500).toISOString(); // Between first and second
    const result = await messageService.getMessages({
      sessionId: testSessionId,
      cursor,
      limit: 10,
    });

    const { messages } = result as any;

    expect(messages).toHaveLength(2);
    // Assistant message - data.data.content
    expect(messages[0].data.data.content).toBe('Second');
    // User message - data.content
    expect(messages[1].data.content).toBe('Third');
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
    expect(messages[0].data.content).toBe('Test message');
  });
});
