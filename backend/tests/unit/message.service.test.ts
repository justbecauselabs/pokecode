import { beforeEach, describe, expect, test, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Database } from 'bun:sqlite';
import { db } from '@/db';
import { sessions, sessionMessages } from '@/db/schema-sqlite';
import { MessageService } from '@/services/message.service';
import {
  systemMessages,
  userMessages,
  assistantMessages,
  toolResultMessages,
  resultMessages,
  conversationFixtures
} from '../fixtures/sdk-messages';
import type { SDKMessage } from '@anthropic-ai/claude-code';

/**
 * Clean up test database by removing all data
 */
async function cleanupTestDatabase(): Promise<void> {
  await db.delete(sessionMessages);
  await db.delete(sessions);
}

/**
 * Create a test session for use in tests
 */
async function createTestSession(params: { id?: string; name?: string; projectPath?: string } = {}): Promise<string> {
  const sessionId = params.id || `test-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  await db.insert(sessions).values({
    id: sessionId,
    name: params.name || 'Test Session',
    projectPath: params.projectPath || '/test/project'
  });

  return sessionId;
}

describe('MessageService', () => {
  let messageService: MessageService;
  let testSessionId: string;

  beforeEach(async () => {
    messageService = new MessageService();
    testSessionId = await createTestSession();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  describe('getMessages', () => {
    test('returns empty array for session with no messages', async () => {
      const messages = await messageService.getMessages(testSessionId);
      expect(messages).toEqual([]);
    });

    test('returns converted API messages in chronological order', async () => {
      // Insert messages in specific order with slight time differences
      const baseTime = Date.now();

      const systemMsg = systemMessages.init(testSessionId);
      const userMsg = userMessages.simple('Hello, can you help me?', testSessionId);
      const assistantMsg = assistantMessages.textResponse('Sure, I can help!', testSessionId);

      // Insert with specific timestamps to test ordering
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'assistant',
        contentData: JSON.stringify(systemMsg),
        createdAt: new Date(baseTime)
      });

      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'user',
        contentData: JSON.stringify(userMsg),
        createdAt: new Date(baseTime + 1000)
      });

      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'assistant',
        contentData: JSON.stringify(assistantMsg),
        createdAt: new Date(baseTime + 2000)
      });

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(3);
      expect(messages[0].messageType).toBe('system');
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toBe('[System: init]');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toBe('Hello, can you help me?');
      expect(messages[2].role).toBe('assistant');
      expect(messages[2].content).toBe('Sure, I can help!');
    });

    test('handles all system message variations', async () => {
      const systemInit = systemMessages.init(testSessionId);
      const systemWithTools = systemMessages.withCustomTools(['bash', 'read'], testSessionId);

      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'assistant', // system messages stored as assistant type
        contentData: JSON.stringify(systemInit)
      });

      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'assistant',
        contentData: JSON.stringify(systemWithTools)
      });

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(2);
      expect(messages[0].messageType).toBe('system');
      expect(messages[0].role).toBe('system');
      expect(messages[0].systemMetadata?.model).toBe('claude-3-5-sonnet-20241022');
      expect(messages[1].messageType).toBe('system');
      expect(messages[1].systemMetadata?.tools).toContain('bash');
      expect(messages[1].systemMetadata?.tools).toContain('read');
    });

    test('handles all user message variations', async () => {
      const simpleUser = userMessages.simple('Simple message', testSessionId);
      const codeReview = userMessages.codeReview(testSessionId);
      const fileAnalysis = userMessages.fileAnalysis('package.json', testSessionId);
      const bugFix = userMessages.bugFix('Component not rendering', testSessionId);

      const messagesToInsert = [simpleUser, codeReview, fileAnalysis, bugFix];

      for (const msg of messagesToInsert) {
        await db.insert(sessionMessages).values({
          sessionId: testSessionId,
          type: 'user',
          contentData: JSON.stringify(msg)
        });
      }

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(4);
      expect(messages[0].content).toBe('Simple message');
      expect(messages[1].content).toBe('Please review this code for best practices and potential issues');
      expect(messages[2].content).toBe('Analyze the file package.json and explain its purpose');
      expect(messages[3].content).toBe('Fix this bug: Component not rendering');
    });

    test('handles all assistant message variations', async () => {
      const textResponse = assistantMessages.textResponse('Plain text response', testSessionId);
      const withThinking = assistantMessages.withThinking('Response', 'Let me think...', testSessionId);
      const fileRead = assistantMessages.fileRead('config.json', testSessionId);
      const bashCommand = assistantMessages.bashCommand('ls -la', 'List files', testSessionId);

      const messagesToInsert = [textResponse, withThinking, fileRead, bashCommand];

      for (const msg of messagesToInsert) {
        await db.insert(sessionMessages).values({
          sessionId: testSessionId,
          type: 'assistant',
          contentData: JSON.stringify(msg)
        });
      }

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(4);

      // Test text response
      expect(messages[0].content).toBe('Plain text response');
      expect(messages[0].role).toBe('assistant');

      // Test thinking message
      expect(messages[1].content).toBe('Response');
      expect(messages[1].thinking).toBe('Let me think...');

      // Test tool use messages
      expect(messages[2].content).toBe(`I'll read the config.json file to understand its contents.`);
      expect(messages[2].toolCalls).toBeDefined();
      expect(messages[2].toolCalls?.[0].name).toBe('read');

      expect(messages[3].content).toBe('List files');
      expect(messages[3].toolCalls?.[0].name).toBe('bash');
    });

    test('handles tool result messages', async () => {
      const toolUseId = 'tool-read-123';
      const fileResult = toolResultMessages.fileResult(toolUseId, '{"name": "test"}', testSessionId);
      const bashResult = toolResultMessages.bashResult(toolUseId, 'total 8\ndrwxr-xr-x 2 user user 4096', false, testSessionId);
      const errorResult = toolResultMessages.errorResult(toolUseId, 'File not found', testSessionId);

      const messagesToInsert = [fileResult, bashResult, errorResult];

      for (const msg of messagesToInsert) {
        await db.insert(sessionMessages).values({
          sessionId: testSessionId,
          type: 'user', // tool results are user messages
          contentData: JSON.stringify(msg)
        });
      }

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(3);

      // All should be user messages with tool results
      expect(messages[0].role).toBe('user');
      expect(messages[0].toolResults).toBeDefined();
      expect(messages[0].toolResults?.[0].content).toBe('{"name": "test"}');
      expect(messages[0].toolResults?.[0].toolUseId).toBe(toolUseId);

      expect(messages[1].toolResults?.[0].content).toBe('total 8\ndrwxr-xr-x 2 user user 4096');
      expect(messages[2].toolResults?.[0].content).toBe('File not found');
      expect(messages[2].toolResults?.[0].isError).toBe(true);
    });

    test('handles result messages', async () => {
      const successResult = resultMessages.success(testSessionId);
      const errorResult = resultMessages.error(testSessionId);
      const highUsageResult = resultMessages.withHighUsage(testSessionId);

      const messagesToInsert = [successResult, errorResult, highUsageResult];

      for (const msg of messagesToInsert) {
        await db.insert(sessionMessages).values({
          sessionId: testSessionId,
          type: 'assistant', // result messages stored as assistant type
          contentData: JSON.stringify(msg)
        });
      }

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(3);

      // Test success result
      expect(messages[0].messageType).toBe('result');
      expect(messages[0].resultMetadata?.isError).toBe(false);
      expect(messages[0].resultMetadata?.result).toBe('Task completed successfully');
      expect(messages[0].resultMetadata?.totalCostUsd).toBe(0.093);

      // Test error result
      expect(messages[1].resultMetadata?.isError).toBe(true);

      // Test high usage result
      expect(messages[2].resultMetadata?.totalCostUsd).toBe(0.75);
      expect(messages[2].resultMetadata?.numTurns).toBe(10);
    });

    test('handles complex assistant messages with citations', async () => {
      const withCitations = assistantMessages.withCitations(
        'Based on the documentation, here are the key points.',
        [
          {
            type: 'char_location',
            cited_text: 'API documentation',
            title: 'API Guide',
            start_char_index: 10,
            end_char_index: 25
          }
        ],
        testSessionId
      );

      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'assistant',
        contentData: JSON.stringify(withCitations)
      });

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Based on the documentation, here are the key points.');
      expect(messages[0].citations).toBeDefined();
      expect(messages[0].citations).toHaveLength(1);
      expect(messages[0].citations?.[0].citedText).toBe('API documentation');
    });

    test('handles web search messages', async () => {
      const webSearchMsg = assistantMessages.withWebSearch(
        'I found some relevant information.',
        [
          {
            url: 'https://example.com',
            title: 'Example Guide',
            encrypted_content: 'encrypted_content_here',
            page_age: '2 days ago'
          }
        ],
        testSessionId
      );

      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'assistant',
        contentData: JSON.stringify(webSearchMsg)
      });

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('I found some relevant information.');
      expect(messages[0].webSearchResults).toBeDefined();
      expect(messages[0].webSearchResults).toHaveLength(1);
      expect(messages[0].webSearchResults?.[0].url).toBe('https://example.com');
    });

    test('handles redacted thinking messages', async () => {
      const redactedThinking = assistantMessages.withRedactedThinking(
        'Here is my response.',
        'redacted_thinking_data',
        testSessionId
      );

      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'assistant',
        contentData: JSON.stringify(redactedThinking)
      });

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Here is my response.');
      expect(messages[0].thinking).toBe('redacted_thinking_data');
    });

    test('handles complete conversation flows', async () => {
      // Use the simple conversation flow from fixtures
      const conversation = conversationFixtures.simpleFlow(testSessionId);

      for (let i = 0; i < conversation.length; i++) {
        const msg = conversation[i];
        const messageType = msg.type === 'user' ? 'user' : 'assistant';

        await db.insert(sessionMessages).values({
          sessionId: testSessionId,
          type: messageType,
          contentData: JSON.stringify(msg),
          createdAt: new Date(Date.now() + i * 1000) // Ensure proper ordering
        });
      }

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(3);
      expect(messages[0].messageType).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toBe('Hello, can you help me with a task?');
      expect(messages[2].role).toBe('assistant');
      expect(messages[2].content).toBe("Hello! I'd be happy to help. What can I do for you?");
    });

    test('skips malformed messages and logs warnings', async () => {
      // Insert a valid message
      const validMsg = userMessages.simple('Valid message', testSessionId);
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'user',
        contentData: JSON.stringify(validMsg)
      });

      // Insert malformed JSON
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'user',
        contentData: 'invalid json {'
      });

      // Insert another valid message
      const validMsg2 = assistantMessages.textResponse('Another valid message', testSessionId);
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'assistant',
        contentData: JSON.stringify(validMsg2)
      });

      // Mock console.warn to capture warnings
      const originalWarn = console.warn;
      const warnings: any[] = [];
      console.warn = (...args: any[]) => warnings.push(args);

      const messages = await messageService.getMessages(testSessionId);

      // Restore console.warn
      console.warn = originalWarn;

      // Should only return the valid messages
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('Valid message');
      expect(messages[1].content).toBe('Another valid message');

      // Should have logged a warning for the malformed message
      expect(warnings).toHaveLength(1);
      expect(warnings[0][0]).toContain('Failed to parse message');
    });

    test('handles empty content data gracefully', async () => {
      // Insert message with null content data
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'user',
        contentData: null
      });

      // Insert message with empty string content data
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'user',
        contentData: ''
      });

      // Insert a valid message
      const validMsg = userMessages.simple('Valid message', testSessionId);
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'user',
        contentData: JSON.stringify(validMsg)
      });

      const messages = await messageService.getMessages(testSessionId);

      // Should only return the valid message
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Valid message');
    });

    test('handles messages from different sessions separately', async () => {
      const otherSessionId = await createTestSession();

      // Insert message in first session
      const msg1 = userMessages.simple('Message in session 1', testSessionId);
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'user',
        contentData: JSON.stringify(msg1)
      });

      // Insert message in second session
      const msg2 = userMessages.simple('Message in session 2', otherSessionId);
      await db.insert(sessionMessages).values({
        sessionId: otherSessionId,
        type: 'user',
        contentData: JSON.stringify(msg2)
      });

      const session1Messages = await messageService.getMessages(testSessionId);
      const session2Messages = await messageService.getMessages(otherSessionId);

      expect(session1Messages).toHaveLength(1);
      expect(session1Messages[0].content).toBe('Message in session 1');

      expect(session2Messages).toHaveLength(1);
      expect(session2Messages[0].content).toBe('Message in session 2');
    });
  });
});
