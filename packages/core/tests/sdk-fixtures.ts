import type { 
  SDKMessage, 
  SDKUserMessage, 
  SDKAssistantMessage, 
  SDKResultMessage 
} from '@anthropic-ai/claude-code';

/**
 * Properly typed SDK message fixtures for testing
 * Based on real Claude Code SDK message formats
 * 
 * These fixtures provide type-safe test data for SDK message testing,
 * ensuring all tests use consistent and properly typed message structures.
 */

// Simple user message
export const userMessage: SDKUserMessage = {
  type: 'user',
  message: {
    role: 'user',
    content: 'Create a hello world function',
  },
  parent_tool_use_id: null,
  session_id: 'test-session-123',
};

// User message with tool result (response to tool use)
export const userToolResultMessage: SDKUserMessage = {
  type: 'user',
  message: {
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: 'tool-use-1',
        content: 'File content:\nfunction hello() { return "world"; }',
      },
    ],
  },
  parent_tool_use_id: 'tool-use-1',
  session_id: 'test-session-123',
};

// Assistant text response
export const assistantTextMessage: SDKAssistantMessage = {
  type: 'assistant',
  message: {
    id: 'msg-123',
    type: 'message',
    role: 'assistant',
    model: 'claude-3-5-sonnet-20241022',
    content: [
      {
        type: 'text',
        text: "I'll create a hello world function for you.",
      },
    ],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: 25,
      output_tokens: 50,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  },
  parent_tool_use_id: null,
  session_id: 'test-session-123',
};

// Assistant message with tool use
export const assistantToolUseMessage: SDKAssistantMessage = {
  type: 'assistant',
  message: {
    id: 'msg-456',
    type: 'message',
    role: 'assistant',
    model: 'claude-3-5-sonnet-20241022',
    content: [
      {
        type: 'text',
        text: "I'll read the file to understand the current implementation.",
      },
      {
        type: 'tool_use',
        id: 'tool-use-1',
        name: 'read_file',
        input: {
          path: 'src/index.ts',
        },
      },
    ],
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: 150,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  },
  parent_tool_use_id: null,
  session_id: 'test-session-123',
};

// Success result message
export const resultSuccessMessage: SDKResultMessage = {
  type: 'result',
  subtype: 'success',
  duration_ms: 5000,
  duration_api_ms: 4500,
  is_error: false,
  num_turns: 2,
  result: 'Task completed successfully',
  session_id: 'test-session-123',
  total_cost_usd: 0.01,
  usage: {
    input_tokens: 200,
    output_tokens: 300,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  },
  permission_denials: [],
};

// Error result message (max turns reached)
export const resultErrorMessage: SDKResultMessage = {
  type: 'result',
  subtype: 'error_max_turns',
  duration_ms: 30000,
  duration_api_ms: 28000,
  is_error: true,
  num_turns: 10,
  session_id: 'test-session-123',
  total_cost_usd: 0.05,
  usage: {
    input_tokens: 1000,
    output_tokens: 1500,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  },
  permission_denials: [
    {
      tool_name: 'bash',
      tool_use_id: 'tool-denied-1',
      tool_input: { command: 'rm -rf /' },
    },
  ],
};

/**
 * Message sequences for testing conversations
 */
export const simpleConversation: SDKMessage[] = [
  userMessage,
  assistantTextMessage,
  resultSuccessMessage,
];

export const toolUseConversation: SDKMessage[] = [
  {
    ...userMessage,
    message: {
      role: 'user',
      content: 'Read the README file and summarize it',
    },
  },
  assistantToolUseMessage,
  userToolResultMessage,
  {
    ...assistantTextMessage,
    message: {
      ...assistantTextMessage.message,
      content: [
        {
          type: 'text',
          text: 'Based on the README, this project is a TypeScript application that...',
        },
      ],
    },
  },
  resultSuccessMessage,
];

/**
 * Factory function to create custom user messages with specific content
 * @param content - The message content
 * @param sessionId - Optional session ID (defaults to 'test-session')
 * @returns Properly typed SDKUserMessage
 */
export function createUserMessage(content: string, sessionId = 'test-session'): SDKUserMessage {
  return {
    type: 'user',
    message: {
      role: 'user',
      content,
    },
    parent_tool_use_id: null,
    session_id: sessionId,
  };
}

/**
 * Factory function to create custom assistant messages
 * @param content - The message content
 * @param tokens - Token usage (defaults to { input: 10, output: 20 })
 * @param sessionId - Optional session ID (defaults to 'test-session')
 * @returns Properly typed SDKAssistantMessage
 */
export function createAssistantMessage(
  content: string,
  tokens = { input: 10, output: 20 },
  sessionId = 'test-session',
): SDKAssistantMessage {
  return {
    type: 'assistant',
    message: {
      id: `msg-${Date.now()}`,
      type: 'message',
      role: 'assistant',
      model: 'claude-3-5-sonnet-20241022',
      content: [
        {
          type: 'text',
          text: content,
        },
      ],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: tokens.input,
        output_tokens: tokens.output,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
    parent_tool_use_id: null,
    session_id: sessionId,
  };
}