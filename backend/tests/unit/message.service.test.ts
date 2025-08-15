import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { db } from '@/db';
import { sessionMessages, sessions } from '@/db/schema-sqlite';
import type { ClaudeCodeSDKAssistantMessage } from '@/schemas/message.schema';
import { MessageService } from '@/services/message.service';
import { extractMessageText } from '@/utils/message-parser';
import {
  assistantMessages,
  conversationFixtures,
  resultMessages,
  systemMessages,
  toolResultMessages,
  userMessages,
} from '../fixtures/sdk-messages';

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
async function createTestSession(
  params: { id?: string; name?: string; projectPath?: string } = {},
): Promise<string> {
  const sessionId =
    params.id || `test-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  await db.insert(sessions).values({
    id: sessionId,
    name: params.name || 'Test Session',
    projectPath: params.projectPath || '/test/project',
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
        createdAt: new Date(baseTime),
      });

      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'user',
        contentData: JSON.stringify(userMsg),
        createdAt: new Date(baseTime + 1000),
      });

      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'assistant',
        contentData: JSON.stringify(assistantMsg),
        createdAt: new Date(baseTime + 2000),
      });

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(3);
      expect(messages[0].type).toBe('claude-code');
      expect(messages[0].data.type).toBe('system');
      expect(extractMessageText(messages[0])).toBe('[System: init]');
      expect(messages[1].data.type).toBe('user');
      expect(extractMessageText(messages[1])).toBe('Hello, can you help me?');
      expect(messages[2].data.type).toBe('assistant');
      expect(extractMessageText(messages[2])).toBe('Sure, I can help!');
    });

    test('handles all system message variations', async () => {
      const systemInit = systemMessages.init(testSessionId);
      const systemWithTools = systemMessages.withCustomTools(['bash', 'read'], testSessionId);

      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'assistant', // system messages stored as assistant type
        contentData: JSON.stringify(systemInit),
      });

      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'assistant',
        contentData: JSON.stringify(systemWithTools),
      });

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(2);
      expect(messages[0].type).toBe('claude-code');
      expect(messages[0].data.type).toBe('system');
      const systemMsg1 = messages[0].data as any;
      expect(systemMsg1.model).toBe('claude-3-5-sonnet-20241022');
      expect(messages[1].data.type).toBe('system');
      const systemMsg2 = messages[1].data as any;
      expect(systemMsg2.tools).toContain('bash');
      expect(systemMsg2.tools).toContain('read');
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
          contentData: JSON.stringify(msg),
        });
      }

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(4);
      expect(extractMessageText(messages[0])).toBe('Simple message');
      expect(extractMessageText(messages[1])).toBe(
        'Please review this code for best practices and potential issues',
      );
      expect(extractMessageText(messages[2])).toBe(
        'Analyze the file package.json and explain its purpose',
      );
      expect(extractMessageText(messages[3])).toBe('Fix this bug: Component not rendering');
    });

    test('handles all assistant message variations', async () => {
      const textResponse = assistantMessages.textResponse('Plain text response', testSessionId);
      const withThinking = assistantMessages.withThinking(
        'Response',
        'Let me think...',
        testSessionId,
      );
      const fileRead = assistantMessages.fileRead('config.json', testSessionId);
      const bashCommand = assistantMessages.bashCommand('ls -la', 'List files', testSessionId);

      const messagesToInsert = [textResponse, withThinking, fileRead, bashCommand];

      for (const msg of messagesToInsert) {
        await db.insert(sessionMessages).values({
          sessionId: testSessionId,
          type: 'assistant',
          contentData: JSON.stringify(msg),
        });
      }

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(4);

      // Test text response
      expect(extractMessageText(messages[0])).toBe('Plain text response');
      expect(messages[0].data.type).toBe('assistant');

      // Test thinking message
      expect(extractMessageText(messages[1])).toBe('Response');
      const thinkingMsg = messages[1].data as ClaudeCodeSDKAssistantMessage;
      expect(thinkingMsg.message.content.find((c: any) => c.type === 'thinking')?.thinking).toBe(
        'Let me think...',
      );

      // Test tool use messages
      expect(extractMessageText(messages[2])).toBe(
        `I'll read the config.json file to understand its contents.`,
      );
      const toolMsg2 = messages[2].data as ClaudeCodeSDKAssistantMessage;
      const toolUse2 = toolMsg2.message.content.find((c: any) => c.type === 'tool_use');
      expect(toolUse2?.name).toBe('read');

      expect(extractMessageText(messages[3])).toBe('List files');
      const toolMsg3 = messages[3].data as ClaudeCodeSDKAssistantMessage;
      const toolUse3 = toolMsg3.message.content.find((c: any) => c.type === 'tool_use');
      expect(toolUse3?.name).toBe('bash');
    });

    test('handles tool result messages', async () => {
      const toolUseId = 'tool-read-123';
      const fileResult = toolResultMessages.fileResult(
        toolUseId,
        '{"name": "test"}',
        testSessionId,
      );
      const bashResult = toolResultMessages.bashResult(
        toolUseId,
        'total 8\ndrwxr-xr-x 2 user user 4096',
        false,
        testSessionId,
      );
      const errorResult = toolResultMessages.errorResult(
        toolUseId,
        'File not found',
        testSessionId,
      );

      const messagesToInsert = [fileResult, bashResult, errorResult];

      for (const msg of messagesToInsert) {
        await db.insert(sessionMessages).values({
          sessionId: testSessionId,
          type: 'user', // tool results are user messages
          contentData: JSON.stringify(msg),
        });
      }

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(3);

      // All should be user messages with tool results in the data
      expect(messages[0].data.type).toBe('user');
      const userMsg1 = messages[0].data as any;
      const toolResult1 = userMsg1.message.content.find((c: any) => c.type === 'tool_result');
      expect(toolResult1?.content).toBe('{"name": "test"}');
      expect(toolResult1?.tool_use_id).toBe(toolUseId);

      const userMsg2 = messages[1].data as any;
      const toolResult2 = userMsg2.message.content.find((c: any) => c.type === 'tool_result');
      expect(toolResult2?.content).toBe('total 8\ndrwxr-xr-x 2 user user 4096');

      const userMsg3 = messages[2].data as any;
      const toolResult3 = userMsg3.message.content.find((c: any) => c.type === 'tool_result');
      expect(toolResult3?.content).toBe('File not found');
      expect(toolResult3?.is_error).toBe(true);
    });

    test('combines tool calls with their results', async () => {
      // Create assistant message with tool calls
      const toolCallMsg = assistantMessages.fileRead('test.txt', testSessionId);

      // Insert the tool call message
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'assistant',
        contentData: JSON.stringify(toolCallMsg),
      });

      // Get the tool ID from the message
      const toolUseContent = toolCallMsg.message.content.find((c: any) => c.type === 'tool_use');
      const toolUseId = toolUseContent?.id;

      // Create a user message with the corresponding tool result
      const resultMsg = toolResultMessages.fileResult(
        toolUseId,
        'File contents here',
        testSessionId,
      );

      // Insert the result message
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'user',
        contentData: JSON.stringify(resultMsg),
      });

      // Test that the service properly combines them
      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(2);

      // The assistant message should have the tool call
      expect(messages[0].data.type).toBe('assistant');
      const assistantMsg = messages[0].data as ClaudeCodeSDKAssistantMessage;
      const toolUseBlock = assistantMsg.message.content.find((c: any) => c.type === 'tool_use');
      expect(toolUseBlock?.name).toBe('read');
      expect(toolUseBlock?.id).toBe(toolUseId);

      // The user message should have tool results
      expect(messages[1].data.type).toBe('user');
      const userMsg = messages[1].data as any;
      const toolResultBlock = userMsg.message.content.find((c: any) => c.type === 'tool_result');
      expect(toolResultBlock?.tool_use_id).toBe(toolUseId);
      expect(toolResultBlock?.content).toBe('File contents here');
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
          contentData: JSON.stringify(msg),
        });
      }

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(3);

      // Test success result
      expect(messages[0].data.type).toBe('result');
      const successMsg = messages[0].data as any;
      expect(successMsg.is_error).toBe(false);
      expect(successMsg.result).toBe('Task completed successfully');
      expect(successMsg.total_cost_usd).toBe(0.093);

      // Test error result
      const errorMsg = messages[1].data as any;
      expect(errorMsg.is_error).toBe(true);

      // Test high usage result
      const highUsageMsg = messages[2].data as any;
      expect(highUsageMsg.total_cost_usd).toBe(0.75);
      expect(highUsageMsg.num_turns).toBe(10);
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
            end_char_index: 25,
          },
        ],
        testSessionId,
      );

      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'assistant',
        contentData: JSON.stringify(withCitations),
      });

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(1);
      expect(extractMessageText(messages[0])).toBe(
        'Based on the documentation, here are the key points.',
      );
      const citationMsg = messages[0].data as ClaudeCodeSDKAssistantMessage;
      const textBlock = citationMsg.message.content.find((c: any) => c.type === 'text');
      expect(textBlock?.citations).toBeDefined();
      expect(textBlock?.citations).toHaveLength(1);
      expect(textBlock?.citations?.[0].cited_text).toBe('API documentation');
    });

    test('handles web search messages', async () => {
      const webSearchMsg = assistantMessages.withWebSearch(
        'I found some relevant information.',
        [
          {
            url: 'https://example.com',
            title: 'Example Guide',
            encrypted_content: 'encrypted_content_here',
            page_age: '2 days ago',
          },
        ],
        testSessionId,
      );

      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'assistant',
        contentData: JSON.stringify(webSearchMsg),
      });

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(1);
      expect(extractMessageText(messages[0])).toBe('I found some relevant information.');
      const webSearchMsgData = messages[0].data as ClaudeCodeSDKAssistantMessage;
      const webSearchBlock = webSearchMsgData.message.content.find(
        (c: any) => c.type === 'web_search_tool_result',
      );
      expect(webSearchBlock?.content).toBeDefined();
      expect(Array.isArray(webSearchBlock?.content)).toBe(true);
      expect((webSearchBlock?.content as any[])?.[0].url).toBe('https://example.com');
    });

    test('handles redacted thinking messages', async () => {
      const redactedThinking = assistantMessages.withRedactedThinking(
        'Here is my response.',
        'redacted_thinking_data',
        testSessionId,
      );

      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'assistant',
        contentData: JSON.stringify(redactedThinking),
      });

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(1);
      expect(extractMessageText(messages[0])).toBe('Here is my response.');
      const thinkingMsgData = messages[0].data as ClaudeCodeSDKAssistantMessage;
      const redactedBlock = thinkingMsgData.message.content.find(
        (c: any) => c.type === 'redacted_thinking',
      );
      expect(redactedBlock?.data).toBe('redacted_thinking_data');
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
          createdAt: new Date(Date.now() + i * 1000), // Ensure proper ordering
        });
      }

      const messages = await messageService.getMessages(testSessionId);

      expect(messages).toHaveLength(3);
      expect(messages[0].data.type).toBe('system');
      expect(messages[1].data.type).toBe('user');
      expect(extractMessageText(messages[1])).toBe('Hello, can you help me with a task?');
      expect(messages[2].data.type).toBe('assistant');
      expect(extractMessageText(messages[2])).toBe(
        "Hello! I'd be happy to help. What can I do for you?",
      );
    });

    test('skips malformed messages and logs warnings', async () => {
      // Insert a valid message
      const validMsg = userMessages.simple('Valid message', testSessionId);
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'user',
        contentData: JSON.stringify(validMsg),
      });

      // Insert malformed JSON
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'user',
        contentData: 'invalid json {',
      });

      // Insert another valid message
      const validMsg2 = assistantMessages.textResponse('Another valid message', testSessionId);
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'assistant',
        contentData: JSON.stringify(validMsg2),
      });

      // Mock console.warn to capture warnings
      const originalWarn = console.warn;
      const warnings: unknown[][] = [];
      console.warn = (...args: unknown[]) => warnings.push(args);

      const messages = await messageService.getMessages(testSessionId);

      // Restore console.warn
      console.warn = originalWarn;

      // Should only return the valid messages
      expect(messages).toHaveLength(2);
      expect(extractMessageText(messages[0])).toBe('Valid message');
      expect(extractMessageText(messages[1])).toBe('Another valid message');

      // Should have logged a warning for the malformed message
      expect(warnings).toHaveLength(1);
      expect(warnings[0][0]).toContain('Failed to parse message');
    });

    test('handles empty content data gracefully', async () => {
      // Insert message with null content data
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'user',
        contentData: null,
      });

      // Insert message with empty string content data
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'user',
        contentData: '',
      });

      // Insert a valid message
      const validMsg = userMessages.simple('Valid message', testSessionId);
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'user',
        contentData: JSON.stringify(validMsg),
      });

      const messages = await messageService.getMessages(testSessionId);

      // Should only return the valid message
      expect(messages).toHaveLength(1);
      expect(extractMessageText(messages[0])).toBe('Valid message');
    });

    test('handles messages from different sessions separately', async () => {
      const otherSessionId = await createTestSession();

      // Insert message in first session
      const msg1 = userMessages.simple('Message in session 1', testSessionId);
      await db.insert(sessionMessages).values({
        sessionId: testSessionId,
        type: 'user',
        contentData: JSON.stringify(msg1),
      });

      // Insert message in second session
      const msg2 = userMessages.simple('Message in session 2', otherSessionId);
      await db.insert(sessionMessages).values({
        sessionId: otherSessionId,
        type: 'user',
        contentData: JSON.stringify(msg2),
      });

      const session1Messages = await messageService.getMessages(testSessionId);
      const session2Messages = await messageService.getMessages(otherSessionId);

      expect(session1Messages).toHaveLength(1);
      expect(extractMessageText(session1Messages[0])).toBe('Message in session 1');

      expect(session2Messages).toHaveLength(1);
      expect(extractMessageText(session2Messages[0])).toBe('Message in session 2');
    });
  });
});
