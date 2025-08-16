import { describe, expect, test } from 'bun:test';
import type { SessionMessage } from '@/db/schema-sqlite/session_messages';
import { extractMessageText, parseDbMessage } from '@/utils/message-parser';

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

describe('extractMessageText', () => {
  describe('User Messages (new Message format)', () => {
    test('extracts text from user message', () => {
      const message = {
        id: 'msg_1',
        type: 'user' as const,
        data: { content: 'Hello, how are you?' },
        parentToolUseId: null,
      };

      const result = extractMessageText(message);

      expect(result).toBe('Hello, how are you?');
    });
  });

  describe('Assistant Messages (new Message format)', () => {
    test('extracts text from assistant text message', () => {
      const message = {
        id: 'msg_1',
        type: 'assistant' as const,
        data: {
          type: 'message',
          data: { content: 'I can help you with that!' },
        },
        parentToolUseId: null,
      };

      const result = extractMessageText(message);

      expect(result).toBe('I can help you with that!');
    });

    test('extracts display text for TodoWrite tool use', () => {
      const message = {
        id: 'msg_1',
        type: 'assistant' as const,
        data: {
          type: 'tool_use',
          toolId: 'toolu_todo_123',
          data: {
            type: 'todo',
            data: {
              todos: [
                { content: 'Task 1', status: 'pending', id: '1' },
                { content: 'Task 2', status: 'completed', id: '2' },
              ],
            },
          },
        },
        parentToolUseId: null,
      };

      const result = extractMessageText(message);

      expect(result).toBe('[Todo list updated]');
    });

    test('extracts display text for Read tool use', () => {
      const filePath =
        '/Users/billy/workspace/bms/ios/Modules/BMS/Sources/Features/Page/BetListView.swift';
      const message = {
        id: 'msg_1',
        type: 'assistant' as const,
        data: {
          type: 'tool_use',
          toolId: 'toolu_read_123',
          data: {
            type: 'read',
            data: { filePath },
          },
        },
        parentToolUseId: null,
      };

      const result = extractMessageText(message);

      expect(result).toBe(`[Reading file: ${filePath}]`);
    });

    test('extracts generic display text for unknown tool use', () => {
      const message = {
        id: 'msg_1',
        type: 'assistant' as const,
        data: {
          type: 'tool_use',
          toolId: 'toolu_unknown_123',
          data: {
            type: 'unknown',
            data: { param: 'value' },
          },
        },
        parentToolUseId: null,
      };

      const result = extractMessageText(message);

      expect(result).toBe('[Tool used]');
    });

    test('extracts display text for tool result (success)', () => {
      const message = {
        id: 'msg_1',
        type: 'assistant' as const,
        data: {
          type: 'tool_result',
          data: {
            toolUseId: 'toolu_123',
            content: 'File content here with some additional text that should be truncated',
            isError: false,
          },
        },
        parentToolUseId: 'parent_123',
      };

      const result = extractMessageText(message);

      expect(result).toBe(
        '[Tool result: File content here with some additional text that should be truncated]',
      );
    });

    test('extracts display text for tool result (error)', () => {
      const message = {
        id: 'msg_1',
        type: 'assistant' as const,
        data: {
          type: 'tool_result',
          data: {
            toolUseId: 'toolu_123',
            content: 'Error: File not found',
            isError: true,
          },
        },
        parentToolUseId: 'parent_123',
      };

      const result = extractMessageText(message);

      expect(result).toBe('[Tool execution failed]');
    });

    test('extracts display text for tool result with long content', () => {
      const longContent = 'A'.repeat(150); // 150 characters
      const message = {
        id: 'msg_1',
        type: 'assistant' as const,
        data: {
          type: 'tool_result',
          data: {
            toolUseId: 'toolu_123',
            content: longContent,
            isError: false,
          },
        },
        parentToolUseId: 'parent_123',
      };

      const result = extractMessageText(message);

      expect(result).toBe(`[Tool result: ${'A'.repeat(100)}...]`);
    });

    test('extracts display text for Bash tool use with description', () => {
      const message = {
        id: 'msg_1',
        type: 'assistant' as const,
        data: {
          type: 'tool_use',
          toolId: 'toolu_bash_desc_123',
          data: {
            type: 'bash',
            data: {
              command: 'cd /Users/billy/workspace/bms/ios && xcodebuild -scheme BMS build',
              timeout: 120000,
              description: 'Build iOS project to verify changes',
            },
          },
        },
        parentToolUseId: null,
      };

      const result = extractMessageText(message);

      expect(result).toBe('[Running: Build iOS project to verify changes]');
    });

    test('extracts display text for Bash tool use without description (short command)', () => {
      const message = {
        id: 'msg_1',
        type: 'assistant' as const,
        data: {
          type: 'tool_use',
          toolId: 'toolu_bash_short_123',
          data: {
            type: 'bash',
            data: {
              command: 'ls -la',
              timeout: 5000,
            },
          },
        },
        parentToolUseId: null,
      };

      const result = extractMessageText(message);

      expect(result).toBe('[Running command: ls -la]');
    });

    test('extracts display text for Bash tool use without description (long command)', () => {
      const longCommand =
        'cd /Users/billy/workspace/bms/ios && xcodebuild -scheme BMS -destination "platform=iOS Simulator,name=iPhone 15" build test archive';
      const message = {
        id: 'msg_1',
        type: 'assistant' as const,
        data: {
          type: 'tool_use',
          toolId: 'toolu_bash_long_123',
          data: {
            type: 'bash',
            data: {
              command: longCommand,
            },
          },
        },
        parentToolUseId: null,
      };

      const result = extractMessageText(message);

      expect(result).toBe(`[Running command: ${longCommand.substring(0, 50)}...]`);
    });
  });

  describe('Other Message Types (new Message format)', () => {
    test('extracts display text for system message', () => {
      const message = {
        id: 'msg_1',
        type: 'system' as const,
        data: {},
        parentToolUseId: null,
      };

      const result = extractMessageText(message);

      expect(result).toBe('[System message]');
    });

    test('extracts display text for result message', () => {
      const message = {
        id: 'msg_1',
        type: 'result' as const,
        data: {},
        parentToolUseId: null,
      };

      const result = extractMessageText(message);

      expect(result).toBe('[Result message]');
    });
  });

  describe('Error Handling (new Message format)', () => {
    test('handles extraction errors gracefully', () => {
      const message = {
        id: 'msg_1',
        type: 'user' as const,
        data: null, // Invalid data
        parentToolUseId: null,
      };

      const result = extractMessageText(message);

      expect(result).toBe('[Failed to extract content]');
    });

    test('handles unknown message type', () => {
      const message = {
        id: 'msg_1',
        type: 'unknown' as any,
        data: {},
        parentToolUseId: null,
      };

      const result = extractMessageText(message);

      expect(result).toBe('[Unknown message type]');
    });
  });
});

describe('parseDbMessage with project path', () => {
  test('shows relative path for Read tool when project path matches', () => {
    const projectPath = '/Users/billy/workspace/pokecode';
    const absoluteFilePath = '/Users/billy/workspace/pokecode/backend/src/app.ts';

    // Create a mock SDK message with Read tool use
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'Read',
            input: {
              file_path: absoluteFilePath,
            },
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          cache_creation: null,
          cache_creation_input_tokens: null,
          cache_read_input_tokens: null,
          input_tokens: 50,
          output_tokens: 25,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage, projectPath);

    expect(result).not.toBeNull();
    expect(result?.type).toBe('assistant');
    expect(result?.data).toMatchObject({
      type: 'tool_use',
      data: {
        type: 'read',
        toolId: 'toolu_1',
        data: {
          filePath: 'backend/src/app.ts', // Should be relative path
        },
      },
    });
  });

  test('shows absolute path for Read tool when project path does not match', () => {
    const projectPath = '/Users/billy/workspace/different-project';
    const absoluteFilePath = '/Users/billy/workspace/pokecode/backend/src/app.ts';

    // Create a mock SDK message with Read tool use
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'Read',
            input: {
              file_path: absoluteFilePath,
            },
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          cache_creation: null,
          cache_creation_input_tokens: null,
          cache_read_input_tokens: null,
          input_tokens: 50,
          output_tokens: 25,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage, projectPath);

    expect(result).not.toBeNull();
    expect(result?.type).toBe('assistant');
    expect(result?.data).toMatchObject({
      type: 'tool_use',
      data: {
        type: 'read',
        toolId: 'toolu_1',
        data: {
          filePath: absoluteFilePath, // Should remain absolute path
        },
      },
    });
  });

  test('works without project path parameter', () => {
    const absoluteFilePath = '/Users/billy/workspace/pokecode/backend/src/app.ts';

    // Create a mock SDK message with Read tool use
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'Read',
            input: {
              file_path: absoluteFilePath,
            },
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          cache_creation: null,
          cache_creation_input_tokens: null,
          cache_read_input_tokens: null,
          input_tokens: 50,
          output_tokens: 25,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage); // No project path

    expect(result).not.toBeNull();
    expect(result?.type).toBe('assistant');
    expect(result?.data).toMatchObject({
      type: 'tool_use',
      data: {
        type: 'read',
        toolId: 'toolu_1',
        data: {
          filePath: absoluteFilePath, // Should remain absolute path
        },
      },
    });
  });
});

describe('parseDbMessage - Tool Result Parsing', () => {
  describe('User messages with tool result content', () => {
    test('parses tool result from user message to assistant tool_result message', () => {
      const sdkMessage = {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              tool_use_id: 'toolu_01M1icexPggYpixsELAVXLmt',
              type: 'tool_result',
              content: 'File content here\nWith multiple lines\nof actual tool output',
            },
          ],
        },
        parent_tool_use_id: null,
        session_id: 'test-session',
      };

      const dbMessage = createMockDbMessage(sdkMessage, 'user');
      const result = parseDbMessage(dbMessage);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('assistant'); // Should be mapped to assistant
      expect(result?.data).toMatchObject({
        type: 'tool_result',
        data: {
          toolUseId: 'toolu_01M1icexPggYpixsELAVXLmt',
          content: 'File content here\nWith multiple lines\nof actual tool output',
          isError: undefined,
        },
      });
      expect(result?.parentToolUseId).toBeNull();
    });

    test('parses tool result with error flag', () => {
      const sdkMessage = {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              tool_use_id: 'toolu_error_123',
              type: 'tool_result',
              content: 'Error: File not found',
              is_error: true,
            },
          ],
        },
        parent_tool_use_id: 'parent_tool_id',
        session_id: 'test-session',
      };

      const dbMessage = createMockDbMessage(sdkMessage, 'user');
      const result = parseDbMessage(dbMessage);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('assistant');
      expect(result?.data).toMatchObject({
        type: 'tool_result',
        data: {
          toolUseId: 'toolu_error_123',
          content: 'Error: File not found',
          isError: true,
        },
      });
      expect(result?.parentToolUseId).toBe('parent_tool_id');
    });

    test('returns null for tool result missing toolUseId', () => {
      const sdkMessage = {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              content: 'Some content',
              // Missing toolUseId
            },
          ],
        },
        parent_tool_use_id: null,
        session_id: 'test-session',
      };

      const dbMessage = createMockDbMessage(sdkMessage, 'user');
      const result = parseDbMessage(dbMessage);

      expect(result).toBeNull();
    });

    test('returns null for tool result missing content', () => {
      const sdkMessage = {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              tool_use_id: 'toolu_123',
              type: 'tool_result',
              // Missing content
            },
          ],
        },
        parent_tool_use_id: null,
        session_id: 'test-session',
      };

      const dbMessage = createMockDbMessage(sdkMessage, 'user');
      const result = parseDbMessage(dbMessage);

      expect(result).toBeNull();
    });

    test('returns null for tool result with non-string content', () => {
      const sdkMessage = {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              tool_use_id: 'toolu_123',
              type: 'tool_result',
              content: 123, // Non-string content
            },
          ],
        },
        parent_tool_use_id: null,
        session_id: 'test-session',
      };

      const dbMessage = createMockDbMessage(sdkMessage, 'user');
      const result = parseDbMessage(dbMessage);

      expect(result).toBeNull();
    });

    test('handles multiple tool result blocks (takes first)', () => {
      const sdkMessage = {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              tool_use_id: 'toolu_first',
              type: 'tool_result',
              content: 'First result',
            },
            {
              tool_use_id: 'toolu_second',
              type: 'tool_result',
              content: 'Second result',
            },
          ],
        },
        parent_tool_use_id: null,
        session_id: 'test-session',
      };

      const dbMessage = createMockDbMessage(sdkMessage, 'user');
      const result = parseDbMessage(dbMessage);

      expect(result).not.toBeNull();
      expect(result?.data).toMatchObject({
        type: 'tool_result',
        data: {
          toolUseId: 'toolu_first', // Should take the first one
          content: 'First result',
        },
      });
    });

    test('returns null for user message with array content but no tool_result blocks', () => {
      const sdkMessage = {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Some text block',
            },
          ],
        },
        parent_tool_use_id: null,
        session_id: 'test-session',
      };

      const dbMessage = createMockDbMessage(sdkMessage, 'user');
      const result = parseDbMessage(dbMessage);

      expect(result).toBeNull();
    });

    test('returns null for user message with empty array content', () => {
      const sdkMessage = {
        type: 'user',
        message: {
          role: 'user',
          content: [],
        },
        parent_tool_use_id: null,
        session_id: 'test-session',
      };

      const dbMessage = createMockDbMessage(sdkMessage, 'user');
      const result = parseDbMessage(dbMessage);

      expect(result).toBeNull();
    });
  });

  describe('User messages with string content (unchanged behavior)', () => {
    test('still parses regular user messages with string content', () => {
      const sdkMessage = {
        type: 'user',
        message: {
          role: 'user',
          content: 'Hello, this is a regular user message',
        },
        parent_tool_use_id: null,
        session_id: 'test-session',
      };

      const dbMessage = createMockDbMessage(sdkMessage, 'user');
      const result = parseDbMessage(dbMessage);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('user');
      expect(result?.data).toMatchObject({
        content: 'Hello, this is a regular user message',
      });
    });

    test('returns null for user message with undefined content', () => {
      const sdkMessage = {
        type: 'user',
        message: {
          role: 'user',
          // No content field
        },
        parent_tool_use_id: null,
        session_id: 'test-session',
      };

      const dbMessage = createMockDbMessage(sdkMessage, 'user');
      const result = parseDbMessage(dbMessage);

      expect(result).toBeNull();
    });

    test('returns null for user message with null content', () => {
      const sdkMessage = {
        type: 'user',
        message: {
          role: 'user',
          content: null,
        },
        parent_tool_use_id: null,
        session_id: 'test-session',
      };

      const dbMessage = createMockDbMessage(sdkMessage, 'user');
      const result = parseDbMessage(dbMessage);

      expect(result).toBeNull();
    });
  });
});

describe('parseDbMessage - Bash Tool Parsing', () => {
  test('parses Bash tool use with all parameters', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_01BUhAhNBoCqMMJHR5pcG4kG',
            name: 'Bash',
            input: {
              command:
                'cd /Users/billy/workspace/bms/ios && xcodebuild -scheme BMS -destination "platform=iOS Simulator,name=iPhone 15" build',
              timeout: 120000,
              description: 'Build iOS project to verify changes',
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: null,
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 50,
          output_tokens: 25,
          service_tier: null,
        },
      },
      parent_tool_use_id: 'toolu_01LrVzHkhCkf5modThqzk7zH',
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).not.toBeNull();
    expect(result?.type).toBe('assistant');
    expect(result?.data).toMatchObject({
      type: 'tool_use',
      data: {
        type: 'bash',
        toolId: 'toolu_01BUhAhNBoCqMMJHR5pcG4kG',
        data: {
          command:
            'cd /Users/billy/workspace/bms/ios && xcodebuild -scheme BMS -destination "platform=iOS Simulator,name=iPhone 15" build',
          timeout: 120000,
          description: 'Build iOS project to verify changes',
        },
      },
    });
    expect(result?.parentToolUseId).toBe('toolu_01LrVzHkhCkf5modThqzk7zH');
  });

  test('parses Bash tool use with only command', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_bash_simple',
            name: 'Bash',
            input: {
              command: 'ls -la',
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 20,
          output_tokens: 10,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).not.toBeNull();
    expect(result?.type).toBe('assistant');
    expect(result?.data).toMatchObject({
      type: 'tool_use',
      data: {
        type: 'bash',
        toolId: 'toolu_bash_simple',
        data: {
          command: 'ls -la',
          timeout: undefined,
          description: undefined,
        },
      },
    });
    expect(result?.parentToolUseId).toBeNull();
  });

  test('parses Bash tool use with command and timeout only', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_bash_timeout',
            name: 'Bash',
            input: {
              command: 'npm run build',
              timeout: 60000,
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 30,
          output_tokens: 15,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).not.toBeNull();
    expect(result?.data).toMatchObject({
      type: 'tool_use',
      data: {
        type: 'bash',
        toolId: 'toolu_bash_timeout',
        data: {
          command: 'npm run build',
          timeout: 60000,
          description: undefined,
        },
      },
    });
  });

  test('returns null for Bash tool use missing command', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_bash_no_command',
            name: 'Bash',
            input: {
              timeout: 30000,
              description: 'Some description but no command',
              // Missing command
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 25,
          output_tokens: 12,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).toBeNull();
  });

  test('returns null for Bash tool use with empty command', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_bash_empty',
            name: 'Bash',
            input: {
              command: '', // Empty command
              timeout: 30000,
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 20,
          output_tokens: 8,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).toBeNull();
  });

  test('prioritizes Bash tool over other tools when multiple tools present', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_read_1',
            name: 'Read',
            input: {
              file_path: '/some/file.txt',
            },
          },
          {
            type: 'tool_use',
            id: 'toolu_bash_1',
            name: 'Bash',
            input: {
              command: 'echo "hello"',
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 40,
          output_tokens: 20,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).not.toBeNull();
    expect(result?.data).toMatchObject({
      type: 'tool_use',
      data: {
        type: 'bash',
        toolId: 'toolu_bash_1',
        data: {
          command: 'echo "hello"',
        },
      },
    });
  });
});

describe('parseDbMessage - Edit Tool Parsing', () => {
  test('parses Edit tool use with all parameters', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_01RpfrLQta5yioKyTXhtrTJp',
            name: 'Edit',
            input: {
              file_path: '/Users/billy/workspace/bms/crates/entities/src/errors.rs',
              old_string:
                '#[derive(Error, Debug)]\npub enum EntitiesError {\n    #[error("could not find environment variable: {0}")]\n    Env(#[from] std::env::VarError),\n}',
              new_string:
                '#[derive(Error, Debug)]\npub enum EntitiesError {\n    #[error("could not find environment variable: {0}")]\n    Env(#[from] std::env::VarError),\n    #[error("Data integrity violation: {0}")]\n    DataIntegrity(String),\n}',
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 50,
          output_tokens: 25,
          service_tier: null,
        },
      },
      parent_tool_use_id: 'toolu_01QYjjvdkG96KUgfZYsKF13i',
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).not.toBeNull();
    expect(result?.type).toBe('assistant');
    expect(result?.data).toMatchObject({
      type: 'tool_use',
      data: {
        type: 'edit',
        toolId: 'toolu_01RpfrLQta5yioKyTXhtrTJp',
        data: {
          filePath: '/Users/billy/workspace/bms/crates/entities/src/errors.rs',
          oldString:
            '#[derive(Error, Debug)]\npub enum EntitiesError {\n    #[error("could not find environment variable: {0}")]\n    Env(#[from] std::env::VarError),\n}',
          newString:
            '#[derive(Error, Debug)]\npub enum EntitiesError {\n    #[error("could not find environment variable: {0}")]\n    Env(#[from] std::env::VarError),\n    #[error("Data integrity violation: {0}")]\n    DataIntegrity(String),\n}',
        },
      },
    });
    expect(result?.parentToolUseId).toBe('toolu_01QYjjvdkG96KUgfZYsKF13i');
  });

  test('parses Edit tool use with relative path when project path matches', () => {
    const projectPath = '/Users/billy/workspace/bms';
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_edit_relative',
            name: 'Edit',
            input: {
              file_path: '/Users/billy/workspace/bms/src/main.rs',
              old_string: 'fn main() {\n    println!("Hello");\n}',
              new_string: 'fn main() {\n    println!("Hello, World!");\n}',
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 30,
          output_tokens: 15,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage, projectPath);

    expect(result).not.toBeNull();
    expect(result?.data).toMatchObject({
      type: 'tool_use',
      data: {
        type: 'edit',
        toolId: 'toolu_edit_relative',
        data: {
          filePath: 'src/main.rs', // Should be relative path
          oldString: 'fn main() {\n    println!("Hello");\n}',
          newString: 'fn main() {\n    println!("Hello, World!");\n}',
        },
      },
    });
  });

  test('returns null for Edit tool use missing file_path', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_edit_no_path',
            name: 'Edit',
            input: {
              old_string: 'old code',
              new_string: 'new code',
              // Missing file_path
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 20,
          output_tokens: 10,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).toBeNull();
  });

  test('returns null for Edit tool use missing old_string', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_edit_no_old',
            name: 'Edit',
            input: {
              file_path: '/path/to/file.rs',
              new_string: 'new code',
              // Missing old_string
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 20,
          output_tokens: 10,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).toBeNull();
  });

  test('returns null for Edit tool use missing new_string', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_edit_no_new',
            name: 'Edit',
            input: {
              file_path: '/path/to/file.rs',
              old_string: 'old code',
              // Missing new_string
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 20,
          output_tokens: 10,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).toBeNull();
  });

  test('prioritizes Edit tool over Read when multiple tools present', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_read_1',
            name: 'Read',
            input: {
              file_path: '/some/file.txt',
            },
          },
          {
            type: 'tool_use',
            id: 'toolu_edit_1',
            name: 'Edit',
            input: {
              file_path: '/some/file.txt',
              old_string: 'old',
              new_string: 'new',
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 40,
          output_tokens: 20,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).not.toBeNull();
    expect(result?.data).toMatchObject({
      type: 'tool_use',
      data: {
        type: 'edit',
        toolId: 'toolu_edit_1',
        data: {
          filePath: '/some/file.txt',
          oldString: 'old',
          newString: 'new',
        },
      },
    });
  });
});

describe('extractMessageText - Edit Tool Display', () => {
  test('extracts display text for Edit tool use', () => {
    const message = {
      id: 'msg_1',
      type: 'assistant' as const,
      data: {
        type: 'tool_use',
        toolId: 'toolu_edit_123',
        data: {
          type: 'edit',
          data: {
            filePath: 'src/main.rs',
            oldString: 'fn main() {\n    println!("Hello");\n}',
            newString: 'fn main() {\n    println!("Hello, World!");\n}',
          },
        },
      },
      parentToolUseId: null,
    };

    const result = extractMessageText(message);

    expect(result).toBe('[Editing file: src/main.rs]');
  });

  test('extracts display text for Edit tool use with absolute path', () => {
    const message = {
      id: 'msg_1',
      type: 'assistant' as const,
      data: {
        type: 'tool_use',
        toolId: 'toolu_edit_abs_123',
        data: {
          type: 'edit',
          data: {
            filePath: '/Users/billy/workspace/bms/crates/entities/src/errors.rs',
            oldString: 'some old code',
            newString: 'some new code',
          },
        },
      },
      parentToolUseId: null,
    };

    const result = extractMessageText(message);

    expect(result).toBe('[Editing file: /Users/billy/workspace/bms/crates/entities/src/errors.rs]');
  });
});

describe('parseDbMessage - MultiEdit Tool Parsing', () => {
  test('parses MultiEdit tool use with all parameters', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_01YWyhNqGnpQkxNNwfvmLZ4M',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_01FjLLis2985qAUrA27hejn6',
            name: 'MultiEdit',
            input: {
              file_path: '/Users/billy/workspace/bms/crates/entities/src/hydrated_bets.rs',
              edits: [
                {
                  old_string:
                    'pub async fn find<C: ConnectionTrait>(\n        query: Select<bets::Entity>,\n        db: &C,\n    ) -> Result<Vec<HydratedBet>, DbErr> {',
                  new_string:
                    'pub async fn find<C: ConnectionTrait>(\n        query: Select<bets::Entity>,\n        db: &C,\n    ) -> Result<Vec<HydratedBet>, EntitiesError> {',
                },
                {
                  old_string: 'let bets = query.all(db).await?;',
                  new_string: 'let bets = query.all(db).await.map_err(EntitiesError::DbErr)?;',
                },
                {
                  old_string:
                    'let picks = picks::Entity::find()\n            .filter(picks::Column::BetId.is_in(bet_ids))\n            .all(db)\n            .await?\n            .into_iter()\n            .into_group_map_by(|p| p.bet_id);',
                  new_string:
                    'let picks = picks::Entity::find()\n            .filter(picks::Column::BetId.is_in(bet_ids))\n            .all(db)\n            .await\n            .map_err(EntitiesError::DbErr)?\n            .into_iter()\n            .into_group_map_by(|p| p.bet_id);',
                },
              ],
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: null,
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 7,
          cache_creation_input_tokens: 1017,
          cache_read_input_tokens: 20155,
          cache_creation: {
            ephemeral_5m_input_tokens: 1017,
            ephemeral_1h_input_tokens: 0,
          },
          output_tokens: 4,
          service_tier: 'standard',
        },
      },
      parent_tool_use_id: 'toolu_01QYjjvdkG96KUgfZYsKF13i',
      session_id: '2056cba1-980e-45b6-b3d3-9b39ecd63beb',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).not.toBeNull();
    expect(result?.type).toBe('assistant');
    expect(result?.data).toMatchObject({
      type: 'tool_use',
      data: {
        type: 'multiedit',
        toolId: 'toolu_01FjLLis2985qAUrA27hejn6',
        data: {
          filePath: '/Users/billy/workspace/bms/crates/entities/src/hydrated_bets.rs',
          edits: [
            {
              oldString:
                'pub async fn find<C: ConnectionTrait>(\n        query: Select<bets::Entity>,\n        db: &C,\n    ) -> Result<Vec<HydratedBet>, DbErr> {',
              newString:
                'pub async fn find<C: ConnectionTrait>(\n        query: Select<bets::Entity>,\n        db: &C,\n    ) -> Result<Vec<HydratedBet>, EntitiesError> {',
              replaceAll: undefined,
            },
            {
              oldString: 'let bets = query.all(db).await?;',
              newString: 'let bets = query.all(db).await.map_err(EntitiesError::DbErr)?;',
              replaceAll: undefined,
            },
            {
              oldString:
                'let picks = picks::Entity::find()\n            .filter(picks::Column::BetId.is_in(bet_ids))\n            .all(db)\n            .await?\n            .into_iter()\n            .into_group_map_by(|p| p.bet_id);',
              newString:
                'let picks = picks::Entity::find()\n            .filter(picks::Column::BetId.is_in(bet_ids))\n            .all(db)\n            .await\n            .map_err(EntitiesError::DbErr)?\n            .into_iter()\n            .into_group_map_by(|p| p.bet_id);',
              replaceAll: undefined,
            },
          ],
        },
      },
    });
    expect(result?.parentToolUseId).toBe('toolu_01QYjjvdkG96KUgfZYsKF13i');
  });

  test('parses MultiEdit tool use with replace_all flags', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_multiedit_with_replace',
            name: 'MultiEdit',
            input: {
              file_path: '/path/to/file.rs',
              edits: [
                {
                  old_string: 'println!("debug");',
                  new_string: 'println!("info");',
                  replace_all: true,
                },
                {
                  old_string: 'fn old_function()',
                  new_string: 'fn new_function()',
                  replace_all: false,
                },
              ],
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 50,
          output_tokens: 25,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).not.toBeNull();
    expect(result?.data).toMatchObject({
      type: 'tool_use',
      data: {
        type: 'multiedit',
        toolId: 'toolu_multiedit_with_replace',
        data: {
          filePath: '/path/to/file.rs',
          edits: [
            {
              oldString: 'println!("debug");',
              newString: 'println!("info");',
              replaceAll: true,
            },
            {
              oldString: 'fn old_function()',
              newString: 'fn new_function()',
              replaceAll: false,
            },
          ],
        },
      },
    });
  });

  test('returns null for MultiEdit tool use missing file_path', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_multiedit_no_path',
            name: 'MultiEdit',
            input: {
              edits: [
                {
                  old_string: 'old',
                  new_string: 'new',
                },
              ],
              // Missing file_path
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 20,
          output_tokens: 10,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).toBeNull();
  });

  test('returns null for MultiEdit tool use with empty edits array', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_multiedit_empty_edits',
            name: 'MultiEdit',
            input: {
              file_path: '/path/to/file.rs',
              edits: [], // Empty edits array
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 20,
          output_tokens: 10,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).toBeNull();
  });

  test('filters out invalid edits missing old_string or new_string', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_multiedit_invalid_edits',
            name: 'MultiEdit',
            input: {
              file_path: '/path/to/file.rs',
              edits: [
                {
                  old_string: 'valid old',
                  new_string: 'valid new',
                },
                {
                  // Missing old_string
                  new_string: 'invalid new',
                },
                {
                  old_string: 'invalid old',
                  // Missing new_string
                },
                {
                  old_string: 'another valid old',
                  new_string: 'another valid new',
                  replace_all: true,
                },
              ],
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 50,
          output_tokens: 25,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).not.toBeNull();
    expect(result?.data).toMatchObject({
      type: 'tool_use',
      data: {
        type: 'multiedit',
        toolId: 'toolu_multiedit_invalid_edits',
        data: {
          filePath: '/path/to/file.rs',
          edits: [
            {
              oldString: 'valid old',
              newString: 'valid new',
              replaceAll: undefined,
            },
            {
              oldString: 'another valid old',
              newString: 'another valid new',
              replaceAll: true,
            },
          ],
        },
      },
    });
  });
});

describe('parseDbMessage - Task Tool Parsing', () => {
  test('parses Task tool use with all parameters', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_01Tvm8Y4jMNYkqsbzDMAUqbf',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_01RQ2cm9rwb3fVyRXFwMmeWW',
            name: 'Task',
            input: {
              subagent_type: 'general-purpose',
              description: 'Review codebase structure',
              prompt:
                'Please thoroughly review this codebase to understand its structure and identify:\n1. One specific iOS improvement that could be made\n2. One specific Rust improvement that could be made\n\nFocus on concrete, actionable improvements rather than general suggestions.',
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: null,
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 7,
          cache_creation_input_tokens: 228,
          cache_read_input_tokens: 21840,
          cache_creation: {
            ephemeral_5m_input_tokens: 228,
            ephemeral_1h_input_tokens: 0,
          },
          output_tokens: 245,
          service_tier: 'standard',
        },
      },
      parent_tool_use_id: null,
      session_id: '2056cba1-980e-45b6-b3d3-9b39ecd63beb',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).not.toBeNull();
    expect(result?.type).toBe('assistant');
    expect(result?.data).toMatchObject({
      type: 'tool_use',
      data: {
        type: 'task',
        toolId: 'toolu_01RQ2cm9rwb3fVyRXFwMmeWW',
        data: {
          subagentType: 'general-purpose',
          description: 'Review codebase structure',
          prompt:
            'Please thoroughly review this codebase to understand its structure and identify:\n1. One specific iOS improvement that could be made\n2. One specific Rust improvement that could be made\n\nFocus on concrete, actionable improvements rather than general suggestions.',
        },
      },
    });
    expect(result?.parentToolUseId).toBeNull();
  });

  test('returns null for Task tool use missing subagent_type', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_task_no_subagent',
            name: 'Task',
            input: {
              description: 'Some description',
              prompt: 'Some prompt',
              // Missing subagent_type
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 25,
          output_tokens: 12,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).toBeNull();
  });

  test('returns null for Task tool use missing description', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_task_no_desc',
            name: 'Task',
            input: {
              subagent_type: 'general-purpose',
              prompt: 'Some prompt',
              // Missing description
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 20,
          output_tokens: 8,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).toBeNull();
  });

  test('returns null for Task tool use missing prompt', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_task_no_prompt',
            name: 'Task',
            input: {
              subagent_type: 'general-purpose',
              description: 'Some description',
              // Missing prompt
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 20,
          output_tokens: 8,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).toBeNull();
  });

  test('prioritizes Task tool over other tools when multiple tools present', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_read_1',
            name: 'Read',
            input: {
              file_path: '/some/file.txt',
            },
          },
          {
            type: 'tool_use',
            id: 'toolu_task_1',
            name: 'Task',
            input: {
              subagent_type: 'general-purpose',
              description: 'Review code',
              prompt: 'Please review this code',
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 40,
          output_tokens: 20,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).not.toBeNull();
    expect(result?.data).toMatchObject({
      type: 'tool_use',
      data: {
        type: 'task',
        toolId: 'toolu_task_1',
        data: {
          subagentType: 'general-purpose',
          description: 'Review code',
          prompt: 'Please review this code',
        },
      },
    });
  });
});

describe('parseDbMessage - Grep Tool Parsing', () => {
  test('parses Grep tool use with all parameters', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_01GrepFullParams',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_01QVzoiJQpJ185ZLQucRdkB8',
            name: 'Grep',
            input: {
              pattern: 'unwrap\\(\\)',
              path: '/Users/billy/workspace/bms/crates',
              output_mode: 'content',
              '-n': true,
              head_limit: 15,
              '-C': 2,
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: null,
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 50,
          output_tokens: 25,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).not.toBeNull();
    expect(result?.type).toBe('assistant');
    expect(result?.data).toMatchObject({
      type: 'tool_use',
      data: {
        type: 'grep',
        toolId: 'toolu_01QVzoiJQpJ185ZLQucRdkB8',
        data: {
          pattern: 'unwrap\\(\\)',
          path: '/Users/billy/workspace/bms/crates',
          outputMode: 'content',
          lineNumbers: true,
          headLimit: 15,
          contextLines: 2,
        },
      },
    });
    expect(result?.parentToolUseId).toBeNull();
  });

  test('parses Grep tool use with minimal parameters', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_grep_minimal',
            name: 'Grep',
            input: {
              pattern: 'BetTextFormatter',
              path: '/Users/billy/workspace/bms/ios',
              output_mode: 'files_with_matches',
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 30,
          output_tokens: 15,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).not.toBeNull();
    expect(result?.data).toMatchObject({
      type: 'tool_use',
      data: {
        type: 'grep',
        toolId: 'toolu_grep_minimal',
        data: {
          pattern: 'BetTextFormatter',
          path: '/Users/billy/workspace/bms/ios',
          outputMode: 'files_with_matches',
          lineNumbers: undefined,
          headLimit: undefined,
          contextLines: undefined,
        },
      },
    });
  });

  test('parses Grep tool use with relative path when project path matches', () => {
    const projectPath = '/Users/billy/workspace/bms';
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_grep_relative',
            name: 'Grep',
            input: {
              pattern: 'func.*async',
              path: '/Users/billy/workspace/bms/ios',
              output_mode: 'content',
              '-n': true,
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 30,
          output_tokens: 15,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage, projectPath);

    expect(result).not.toBeNull();
    expect(result?.data).toMatchObject({
      type: 'tool_use',
      data: {
        type: 'grep',
        toolId: 'toolu_grep_relative',
        data: {
          pattern: 'func.*async',
          path: 'ios', // Should be relative path
          outputMode: 'content',
          lineNumbers: true,
        },
      },
    });
  });

  test('returns null for Grep tool use missing pattern', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_grep_no_pattern',
            name: 'Grep',
            input: {
              path: '/some/path',
              output_mode: 'content',
              // Missing pattern
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 20,
          output_tokens: 8,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).toBeNull();
  });

  test('returns null for Grep tool use missing path', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_grep_no_path',
            name: 'Grep',
            input: {
              pattern: 'some.*pattern',
              output_mode: 'content',
              // Missing path
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 20,
          output_tokens: 8,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).toBeNull();
  });

  test('returns null for Grep tool use missing output_mode', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_grep_no_output_mode',
            name: 'Grep',
            input: {
              pattern: 'some.*pattern',
              path: '/some/path',
              // Missing output_mode
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 20,
          output_tokens: 8,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).toBeNull();
  });

  test('prioritizes Grep tool over Read when multiple tools present', () => {
    const sdkMessage = {
      type: 'assistant',
      message: {
        id: 'msg_1',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_read_1',
            name: 'Read',
            input: {
              file_path: '/some/file.txt',
            },
          },
          {
            type: 'tool_use',
            id: 'toolu_grep_1',
            name: 'Grep',
            input: {
              pattern: 'search.*term',
              path: '/some/path',
              output_mode: 'content',
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'tool_use',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 40,
          output_tokens: 20,
          service_tier: null,
        },
      },
      parent_tool_use_id: null,
      session_id: 'test-session',
    };

    const dbMessage = createMockDbMessage(sdkMessage, 'assistant');
    const result = parseDbMessage(dbMessage);

    expect(result).not.toBeNull();
    expect(result?.data).toMatchObject({
      type: 'tool_use',
      data: {
        type: 'grep',
        toolId: 'toolu_grep_1',
        data: {
          pattern: 'search.*term',
          path: '/some/path',
          outputMode: 'content',
        },
      },
    });
  });
});

describe('extractMessageText - MultiEdit Tool Display', () => {
  test('extracts display text for MultiEdit tool use', () => {
    const message = {
      id: 'msg_1',
      type: 'assistant' as const,
      data: {
        type: 'tool_use',
        toolId: 'toolu_multiedit_123',
        data: {
          type: 'multiedit',
          data: {
            filePath: 'src/main.rs',
            edits: [
              {
                oldString: 'old1',
                newString: 'new1',
              },
              {
                oldString: 'old2',
                newString: 'new2',
              },
              {
                oldString: 'old3',
                newString: 'new3',
              },
            ],
          },
        },
      },
      parentToolUseId: null,
    };

    const result = extractMessageText(message);

    expect(result).toBe('[Multi-editing file: src/main.rs (3 edits)]');
  });

  test('extracts display text for Task tool use', () => {
    const message = {
      id: 'msg_1',
      type: 'assistant' as const,
      data: {
        type: 'tool_use',
        toolId: 'toolu_task_123',
        data: {
          type: 'task',
          data: {
            subagentType: 'general-purpose',
            description: 'Review codebase structure',
            prompt: 'Please thoroughly review this codebase to understand its structure...',
          },
        },
      },
      parentToolUseId: null,
    };

    const result = extractMessageText(message);

    expect(result).toBe('[Launching general-purpose agent: Review codebase structure]');
  });

  test('extracts display text for Grep tool use', () => {
    const message = {
      id: 'msg_1',
      type: 'assistant' as const,
      data: {
        type: 'tool_use',
        toolId: 'toolu_grep_123',
        data: {
          type: 'grep',
          data: {
            pattern: 'unwrap\\(\\)',
            path: 'crates',
            outputMode: 'content',
            lineNumbers: true,
            headLimit: 15,
          },
        },
      },
      parentToolUseId: null,
    };

    const result = extractMessageText(message);

    expect(result).toBe('[Searching for "unwrap\\(\\)" in crates]');
  });

  test('extracts display text for MultiEdit tool use with absolute path', () => {
    const message = {
      id: 'msg_1',
      type: 'assistant' as const,
      data: {
        type: 'tool_use',
        toolId: 'toolu_multiedit_abs_123',
        data: {
          type: 'multiedit',
          data: {
            filePath: '/Users/billy/workspace/bms/crates/entities/src/hydrated_bets.rs',
            edits: [
              {
                oldString: 'some old code',
                newString: 'some new code',
              },
            ],
          },
        },
      },
      parentToolUseId: null,
    };

    const result = extractMessageText(message);

    expect(result).toBe(
      '[Multi-editing file: /Users/billy/workspace/bms/crates/entities/src/hydrated_bets.rs (1 edits)]',
    );
  });
});
