import { describe, expect, test } from 'bun:test';
import type { SessionMessage } from '@/db/schema-sqlite/session_messages';
import { extractMessageText, parseDbMessage } from '@/utils/message-parser';
import { assistantMessages, systemMessages, userMessages } from '../fixtures/sdk-messages';

/**
 * Helper to create mock SessionMessage from SDK message
 */
function createMockDbMessage(
  sdkMessage: any,
  type: 'user' | 'assistant' | 'system',
  id = `msg_${Date.now()}`,
): SessionMessage {
  return {
    id,
    sessionId: 'test-session-1',
    type,
    contentData: JSON.stringify(sdkMessage),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('parseDbMessage', () => {
  describe('User Messages', () => {
    test('parses simple user message with string content', () => {
      const sdkMessage = userMessages.simple('Hello, can you help me?');
      const dbMessage = createMockDbMessage(sdkMessage, 'user');

      const result = parseDbMessage(dbMessage);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('user');
      expect(result?.data).toEqual({
        content: 'Hello, can you help me?',
      });
      expect(result?.parentToolUseId).toBeNull();
    });

    test('parses user message with parentToolUseId', () => {
      const parentToolUseId = 'tool-123';
      const sdkMessage = {
        ...userMessages.simple('Tool result message'),
        parent_tool_use_id: parentToolUseId,
      };
      const dbMessage = createMockDbMessage(sdkMessage, 'user');

      const result = parseDbMessage(dbMessage);

      expect(result).not.toBeNull();
      expect(result?.parentToolUseId).toBe(parentToolUseId);
    });

    test('returns null for user message without string content', () => {
      const sdkMessage = {
        type: 'user',
        session_id: 'test-session-1',
        parent_tool_use_id: null,
        message: {
          content: null, // Invalid content
          role: 'user',
        },
      };
      const dbMessage = createMockDbMessage(sdkMessage, 'user');

      const result = parseDbMessage(dbMessage);

      expect(result).toBeNull();
    });

    test('returns null for user message with non-string content', () => {
      const sdkMessage = {
        type: 'user',
        session_id: 'test-session-1',
        parent_tool_use_id: null,
        message: {
          content: 123, // Invalid content type
          role: 'user',
        },
      };
      const dbMessage = createMockDbMessage(sdkMessage, 'user');

      const result = parseDbMessage(dbMessage);

      expect(result).toBeNull();
    });
  });

  describe('Assistant Messages', () => {
    test('parses simple assistant text message', () => {
      const sdkMessage = assistantMessages.textResponse('I can help you with that!');
      const dbMessage = createMockDbMessage(sdkMessage, 'assistant');

      const result = parseDbMessage(dbMessage);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('assistant');
      expect(result?.data).toEqual({
        type: 'message',
        data: {
          content: 'I can help you with that!',
        },
      });
    });

    test('parses assistant message with thinking blocks', () => {
      const sdkMessage = assistantMessages.withThinking(
        'Here is my response.',
        'Let me think about this carefully...',
      );
      const dbMessage = createMockDbMessage(sdkMessage, 'assistant');

      const result = parseDbMessage(dbMessage);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('assistant');
      expect(result?.data).toEqual({
        type: 'message',
        data: {
          content: 'Here is my response.',
        },
      });
    });

    test('parses TodoWrite tool use message', () => {
      const todos = [
        { content: 'Task 1', status: 'pending', id: '1' },
        { content: 'Task 2', status: 'completed', id: '2' },
      ];
      const sdkMessage = assistantMessages.todoToolUse(
        'I will create a todo list for this task.',
        todos,
      );
      const dbMessage = createMockDbMessage(sdkMessage, 'assistant');

      const result = parseDbMessage(dbMessage);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('assistant');
      expect(result?.data).toEqual({
        type: 'tool_use',
        data: {
          type: 'todo',
          data: { todos },
        },
      });
    });

    test('parses assistant message with other tool use (not TodoWrite)', () => {
      const sdkMessage = assistantMessages.fileRead('package.json');
      const dbMessage = createMockDbMessage(sdkMessage, 'assistant');

      const result = parseDbMessage(dbMessage);

      // Should fall back to text content extraction
      expect(result).not.toBeNull();
      expect(result?.type).toBe('assistant');
      expect(result?.data).toEqual({
        type: 'message',
        data: {
          content: "I'll read the package.json file to understand its contents.",
        },
      });
    });

    test('returns null for assistant message without content array', () => {
      const sdkMessage = {
        type: 'assistant',
        session_id: 'test-session-1',
        parent_tool_use_id: null,
        message: {
          content: 'invalid', // Should be array
          role: 'assistant',
        },
      };
      const dbMessage = createMockDbMessage(sdkMessage, 'assistant');

      const result = parseDbMessage(dbMessage);

      expect(result).toBeNull();
    });

    test('returns null for assistant message with empty content', () => {
      const sdkMessage = {
        type: 'assistant',
        session_id: 'test-session-1',
        parent_tool_use_id: null,
        message: {
          content: [], // Empty array
          role: 'assistant',
        },
      };
      const dbMessage = createMockDbMessage(sdkMessage, 'assistant');

      const result = parseDbMessage(dbMessage);

      expect(result).toBeNull();
    });

    test('extracts text from multiple text blocks', () => {
      const sdkMessage = {
        type: 'assistant',
        session_id: 'test-session-1',
        parent_tool_use_id: null,
        message: {
          content: [
            { type: 'text', text: 'First paragraph.' },
            { type: 'text', text: 'Second paragraph.' },
          ],
          role: 'assistant',
        },
      };
      const dbMessage = createMockDbMessage(sdkMessage, 'assistant');

      const result = parseDbMessage(dbMessage);

      expect(result).not.toBeNull();
      expect(result?.data).toEqual({
        type: 'message',
        data: {
          content: 'First paragraph.\nSecond paragraph.',
        },
      });
    });
  });

  describe('Error Handling', () => {
    test('returns null for message with null contentData', () => {
      const dbMessage: SessionMessage = {
        id: 'msg_1',
        sessionId: 'test-session-1',
        type: 'user',
        contentData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = parseDbMessage(dbMessage);

      expect(result).toBeNull();
    });

    test('returns null for message with invalid JSON', () => {
      const dbMessage: SessionMessage = {
        id: 'msg_1',
        sessionId: 'test-session-1',
        type: 'user',
        contentData: 'invalid json {',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = parseDbMessage(dbMessage);

      expect(result).toBeNull();
    });

    test('returns null for mismatched message types', () => {
      const userSdkMessage = userMessages.simple('Hello');
      const dbMessage = createMockDbMessage(userSdkMessage, 'assistant'); // Wrong type

      const result = parseDbMessage(dbMessage);

      expect(result).toBeNull();
    });

    test('returns null for unsupported message types', () => {
      const systemSdkMessage = systemMessages.init();
      const dbMessage = createMockDbMessage(systemSdkMessage, 'user'); // System stored as user

      const result = parseDbMessage(dbMessage);

      expect(result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    test('handles TodoWrite tool use without input', () => {
      const sdkMessage = assistantMessages.withToolUse(
        'I will use TodoWrite tool.',
        'TodoWrite',
        {}, // No todos property
      );
      const dbMessage = createMockDbMessage(sdkMessage, 'assistant');

      const result = parseDbMessage(dbMessage);

      // Should fall back to text content
      expect(result).not.toBeNull();
      expect(result?.data).toEqual({
        type: 'message',
        data: {
          content: 'I will use TodoWrite tool.',
        },
      });
    });

    test('handles TodoWrite tool use with invalid input structure', () => {
      const sdkMessage = assistantMessages.withToolUse(
        'I will use TodoWrite tool.',
        'TodoWrite',
        { todos: 'invalid' }, // Invalid todos structure
      );
      const dbMessage = createMockDbMessage(sdkMessage, 'assistant');

      const result = parseDbMessage(dbMessage);

      // Parser doesn't validate todos structure, so it accepts any value
      expect(result).not.toBeNull();
      expect(result?.data).toEqual({
        type: 'tool_use',
        data: {
          type: 'todo',
          data: {
            todos: 'invalid',
          },
        },
      });
    });

    test('filters out non-text blocks in text extraction', () => {
      const sdkMessage = {
        type: 'assistant',
        session_id: 'test-session-1',
        parent_tool_use_id: null,
        message: {
          content: [
            { type: 'text', text: 'Valid text.' },
            { type: 'tool_use', name: 'SomeTool' }, // Should be filtered out
            { type: 'other_block', data: 'something' }, // Should be filtered out
            { type: 'text', text: 'More text.' },
          ],
          role: 'assistant',
        },
      };
      const dbMessage = createMockDbMessage(sdkMessage, 'assistant');

      const result = parseDbMessage(dbMessage);

      expect(result).not.toBeNull();
      expect(result?.data).toEqual({
        type: 'message',
        data: {
          content: 'Valid text.\nMore text.',
        },
      });
    });
  });
});

describe('extractMessageText', () => {
  describe('User Messages (deprecated Message format)', () => {
    test('extracts text from user message with string content', () => {
      const sdkMessage = userMessages.simple('Hello world');
      const message = {
        id: 'msg_1',
        type: 'claude-code' as const,
        data: sdkMessage,
      };

      const result = extractMessageText(message);

      expect(result).toBe('Hello world');
    });

    test('extracts text from user message with content blocks', () => {
      const sdkMessage = userMessages.withToolResults('Here is my message', [
        { type: 'tool_result', tool_use_id: 'tool-1', content: 'result' },
      ]);
      const message = {
        id: 'msg_1',
        type: 'claude-code' as const,
        data: sdkMessage,
      };

      const result = extractMessageText(message);

      expect(result).toBe('Here is my message');
    });

    test('returns empty string for user message without text content', () => {
      const sdkMessage = {
        type: 'user',
        session_id: 'test-session-1',
        parent_tool_use_id: null,
        message: {
          content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: 'result' }],
          role: 'user',
        },
      };
      const message = {
        id: 'msg_1',
        type: 'claude-code' as const,
        data: sdkMessage,
      };

      const result = extractMessageText(message);

      expect(result).toBe('');
    });
  });

  describe('Assistant Messages (deprecated Message format)', () => {
    test('extracts text from assistant message', () => {
      const sdkMessage = assistantMessages.textResponse('I can help with that!');
      const message = {
        id: 'msg_1',
        type: 'claude-code' as const,
        data: sdkMessage,
      };

      const result = extractMessageText(message);

      expect(result).toBe('I can help with that!');
    });

    test('extracts text while ignoring other content blocks', () => {
      const sdkMessage = assistantMessages.fileRead('config.json');
      const message = {
        id: 'msg_1',
        type: 'claude-code' as const,
        data: sdkMessage,
      };

      const result = extractMessageText(message);

      expect(result).toBe("I'll read the config.json file to understand its contents.");
    });

    test('combines text from multiple text blocks', () => {
      const sdkMessage = {
        type: 'assistant',
        session_id: 'test-session-1',
        parent_tool_use_id: null,
        message: {
          content: [
            { type: 'text', text: 'First line.' },
            { type: 'tool_use', name: 'SomeTool' },
            { type: 'text', text: 'Second line.' },
          ],
          role: 'assistant',
        },
      };
      const message = {
        id: 'msg_1',
        type: 'claude-code' as const,
        data: sdkMessage,
      };

      const result = extractMessageText(message);

      expect(result).toBe('First line.\nSecond line.');
    });
  });

  describe('System Messages (deprecated Message format)', () => {
    test('extracts system message label', () => {
      const sdkMessage = systemMessages.init();
      const message = {
        id: 'msg_1',
        type: 'claude-code' as const,
        data: sdkMessage,
      };

      const result = extractMessageText(message);

      expect(result).toBe('[System: init]');
    });
  });

  describe('Result Messages (deprecated Message format)', () => {
    test('extracts success result message', () => {
      const sdkMessage = {
        type: 'result',
        subtype: 'success',
        session_id: 'test-session-1',
        result: 'Task completed successfully',
        is_error: false,
      };
      const message = {
        id: 'msg_1',
        type: 'claude-code' as const,
        data: sdkMessage,
      };

      const result = extractMessageText(message);

      expect(result).toBe('Task completed successfully');
    });

    test('extracts success result without result field', () => {
      const sdkMessage = {
        type: 'result',
        subtype: 'success',
        session_id: 'test-session-1',
        is_error: false,
      };
      const message = {
        id: 'msg_1',
        type: 'claude-code' as const,
        data: sdkMessage,
      };

      const result = extractMessageText(message);

      // When 'result' property doesn't exist, it returns error format
      expect(result).toBe('[Error: success]');
    });

    test('extracts error result message', () => {
      const sdkMessage = {
        type: 'result',
        subtype: 'error_during_execution',
        session_id: 'test-session-1',
        is_error: true,
      };
      const message = {
        id: 'msg_1',
        type: 'claude-code' as const,
        data: sdkMessage,
      };

      const result = extractMessageText(message);

      expect(result).toBe('[Error: error_during_execution]');
    });
  });

  describe('Error Handling', () => {
    test('returns fallback message for unknown message type', () => {
      const sdkMessage = {
        type: 'unknown',
        session_id: 'test-session-1',
      };
      const message = {
        id: 'msg_1',
        type: 'claude-code' as const,
        data: sdkMessage,
      };

      const result = extractMessageText(message);

      expect(result).toBe('[Unknown message type]');
    });

    test('returns fallback message when extraction fails', () => {
      const message = {
        id: 'msg_1',
        type: 'claude-code' as const,
        data: null, // Invalid data
      };

      const result = extractMessageText(message);

      expect(result).toBe('[Failed to extract content]');
    });

    test('handles malformed message structure gracefully', () => {
      const message = {
        id: 'msg_1',
        type: 'claude-code' as const,
        data: {
          type: 'user',
          message: null, // Invalid structure
        },
      };

      const result = extractMessageText(message);

      expect(result).toBe('[Failed to extract content]');
    });
  });
});
