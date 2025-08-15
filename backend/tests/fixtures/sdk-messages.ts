/**
 * Comprehensive SDK message fixtures for testing
 * Based on real Claude Code SDK message types and patterns
 */

import type {
  ClaudeCodeSDKAssistantMessage,
  ClaudeCodeSDKResultMessage,
  ClaudeCodeSDKSystemMessage,
  ClaudeCodeSDKUserMessage,
} from '../../src/schemas/message.schema';

export const usage = {
  input_tokens: 1500,
  output_tokens: 800,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  service_tier: 'standard' as const,
  cache_creation: {
    ephemeral_1h_input_tokens: 0,
    ephemeral_5m_input_tokens: 0,
  },
  server_tool_use: {
    web_search_requests: 0,
  },
};

/**
 * System initialization messages
 */
export const systemMessages = {
  init: (sessionId = 'test-session-1'): ClaudeCodeSDKSystemMessage => ({
    type: 'system',
    subtype: 'init',
    session_id: sessionId,
    apiKeySource: 'user',
    cwd: '/test/project',
    tools: ['bash', 'read', 'write', 'edit', 'grep', 'glob'],
    mcp_servers: [],
    model: 'claude-3-5-sonnet-20241022',
    permissionMode: 'bypassPermissions',
    slash_commands: [],
  }),

  withCustomTools: (tools: string[], sessionId = 'test-session-1'): ClaudeCodeSDKSystemMessage => ({
    type: 'system',
    subtype: 'init',
    session_id: sessionId,
    apiKeySource: 'user',
    cwd: '/test/project',
    tools,
    mcp_servers: [],
    model: 'claude-3-5-sonnet-20241022',
    permissionMode: 'bypassPermissions',
    slash_commands: [],
  }),
};

/**
 * User message fixtures
 */
export const userMessages = {
  simple: (text: string, sessionId = 'test-session-1'): ClaudeCodeSDKUserMessage => ({
    type: 'user',
    session_id: sessionId,
    parent_tool_use_id: null,
    message: {
      content: text,
      role: 'user',
    },
  }),

  withToolResults: (
    text: string,
    toolResults: Array<{ type: string; [key: string]: unknown }>,
    sessionId = 'test-session-1',
  ): ClaudeCodeSDKUserMessage => ({
    type: 'user',
    session_id: sessionId,
    parent_tool_use_id: null,
    message: {
      content: [
        {
          type: 'text',
          text,
        },
        ...toolResults,
      ],
      role: 'user',
    },
  }),

  codeReview: (sessionId = 'test-session-1'): ClaudeCodeSDKUserMessage => ({
    type: 'user',
    session_id: sessionId,
    parent_tool_use_id: null,
    message: {
      content: 'Please review this code for best practices and potential issues',
      role: 'user',
    },
  }),

  fileAnalysis: (fileName: string, sessionId = 'test-session-1'): ClaudeCodeSDKUserMessage => ({
    type: 'user',
    session_id: sessionId,
    parent_tool_use_id: null,
    message: {
      content: `Analyze the file ${fileName} and explain its purpose`,
      role: 'user',
    },
  }),

  bugFix: (description: string, sessionId = 'test-session-1'): ClaudeCodeSDKUserMessage => ({
    type: 'user',
    session_id: sessionId,
    parent_tool_use_id: null,
    message: {
      content: `Fix this bug: ${description}`,
      role: 'user',
    },
  }),
};

/**
 * Assistant message fixtures
 */
export const assistantMessages = {
  textResponse: (text: string, sessionId = 'test-session-1'): ClaudeCodeSDKAssistantMessage => ({
    type: 'assistant',
    session_id: sessionId,
    parent_tool_use_id: null,
    message: {
      id: `msg_${Date.now()}`,
      content: [
        {
          type: 'text',
          text,
          citations: null,
        },
      ],
      model: 'claude-3-5-sonnet-20241022',
      role: 'assistant',
      stop_reason: 'end_turn',
      stop_sequence: null,
      type: 'message',
      usage,
    },
  }),

  withThinking: (
    text: string,
    thinking: string,
    sessionId = 'test-session-1',
  ): ClaudeCodeSDKAssistantMessage => ({
    type: 'assistant',
    session_id: sessionId,
    parent_tool_use_id: null,
    message: {
      id: `msg_${Date.now()}`,
      content: [
        {
          type: 'thinking',
          thinking,
          signature: 'thinking',
        },
        {
          type: 'text',
          text,
          citations: null,
        },
      ],
      model: 'claude-3-5-sonnet-20241022',
      role: 'assistant',
      stop_reason: 'end_turn',
      stop_sequence: null,
      type: 'message',
      usage,
    },
  }),

  withToolUse: (
    text: string,
    toolName: string,
    input: Record<string, unknown>,
    sessionId = 'test-session-1',
  ): ClaudeCodeSDKAssistantMessage => ({
    type: 'assistant',
    session_id: sessionId,
    parent_tool_use_id: null,
    message: {
      id: `msg_${Date.now()}`,
      content: [
        {
          type: 'text',
          text,
          citations: null,
        },
        {
          type: 'tool_use',
          id: `tool-${toolName}-${Date.now()}`,
          name: toolName,
          input,
        },
      ],
      model: 'claude-3-5-sonnet-20241022',
      role: 'assistant',
      stop_reason: 'tool_use',
      stop_sequence: null,
      type: 'message',
      usage,
    },
  }),

  fileRead: (fileName: string, sessionId = 'test-session-1'): ClaudeCodeSDKAssistantMessage =>
    assistantMessages.withToolUse(
      `I'll read the ${fileName} file to understand its contents.`,
      'read',
      { file_path: fileName },
      sessionId,
    ),

  fileWrite: (
    fileName: string,
    content: string,
    sessionId = 'test-session-1',
  ): ClaudeCodeSDKAssistantMessage =>
    assistantMessages.withToolUse(
      `I'll create the ${fileName} file with the requested content.`,
      'write',
      { file_path: fileName, content },
      sessionId,
    ),

  bashCommand: (
    command: string,
    description: string,
    sessionId = 'test-session-1',
  ): ClaudeCodeSDKAssistantMessage =>
    assistantMessages.withToolUse(description, 'bash', { command }, sessionId),

  withCitations: (
    text: string,
    citations: Array<{
      type: 'char_location' | 'page_location' | 'web_search_result_location';
      cited_text: string;
      url?: string;
      title?: string;
      document_index?: number;
      start_char_index?: number;
      end_char_index?: number;
    }>,
    sessionId = 'test-session-1',
  ): ClaudeCodeSDKAssistantMessage => ({
    type: 'assistant',
    session_id: sessionId,
    parent_tool_use_id: null,
    message: {
      id: `msg_${Date.now()}`,
      content: [
        {
          type: 'text',
          text,
          citations: citations.map((c) => {
            if (c.type === 'char_location') {
              return {
                type: c.type,
                cited_text: c.cited_text,
                document_index: c.document_index || 0,
                document_title: c.title || 'Unknown Document',
                file_id: 'file-id-123',
                start_char_index: c.start_char_index || 0,
                end_char_index: c.end_char_index || 0,
              };
            }
            if (c.type === 'page_location') {
              return {
                type: c.type,
                cited_text: c.cited_text,
                document_index: c.document_index || 0,
                document_title: c.title || 'Unknown Document',
                file_id: 'file-id-123',
                start_page_number: 1,
                end_page_number: 1,
              };
            }
            // web_search_result_location
            return {
              type: c.type,
              cited_text: c.cited_text,
              encrypted_index: 'encrypted-123',
              url: c.url || '',
              title: c.title || 'Unknown Title',
            };
          }),
        },
      ],
      model: 'claude-3-5-sonnet-20241022',
      role: 'assistant',
      stop_reason: 'end_turn',
      stop_sequence: null,
      type: 'message',
      usage,
    },
  }),

  withWebSearch: (
    text: string,
    searchResults: Array<{
      url: string;
      title: string;
      encrypted_content: string;
      page_age?: string;
    }>,
    sessionId = 'test-session-1',
  ): ClaudeCodeSDKAssistantMessage => ({
    type: 'assistant',
    session_id: sessionId,
    parent_tool_use_id: null,
    message: {
      id: `msg_${Date.now()}`,
      content: [
        {
          type: 'text',
          text,
          citations: null,
        },
        {
          type: 'web_search_tool_result',
          tool_use_id: `tool-websearch-${Date.now()}`,
          content: searchResults.map((result) => ({
            type: 'web_search_result' as const,
            url: result.url,
            title: result.title,
            encrypted_content: result.encrypted_content,
            page_age: result.page_age || '',
          })),
        },
      ],
      model: 'claude-3-5-sonnet-20241022',
      role: 'assistant',
      stop_reason: 'end_turn',
      stop_sequence: null,
      type: 'message',
      usage,
    },
  }),

  withRedactedThinking: (
    text: string,
    data: string,
    sessionId = 'test-session-1',
  ): ClaudeCodeSDKAssistantMessage => ({
    type: 'assistant',
    session_id: sessionId,
    parent_tool_use_id: null,
    message: {
      id: `msg_${Date.now()}`,
      content: [
        {
          type: 'redacted_thinking',
          data,
        },
        {
          type: 'text',
          text,
          citations: null,
        },
      ],
      model: 'claude-3-5-sonnet-20241022',
      role: 'assistant',
      stop_reason: 'end_turn',
      stop_sequence: null,
      type: 'message',
      usage,
    },
  }),
};

/**
 * Tool result fixtures (as user messages with tool_result content)
 */
export const toolResultMessages = {
  bashResult: (
    toolUseId: string,
    output: string,
    isError = false,
    sessionId = 'test-session-1',
  ): ClaudeCodeSDKUserMessage => ({
    type: 'user',
    session_id: sessionId,
    parent_tool_use_id: toolUseId,
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: output,
          is_error: isError,
        },
      ],
    },
  }),

  fileResult: (
    toolUseId: string,
    fileContent: string,
    sessionId = 'test-session-1',
  ): ClaudeCodeSDKUserMessage => ({
    type: 'user',
    session_id: sessionId,
    parent_tool_use_id: toolUseId,
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: fileContent,
          is_error: false,
        },
      ],
    },
  }),

  errorResult: (
    toolUseId: string,
    errorMessage: string,
    sessionId = 'test-session-1',
  ): ClaudeCodeSDKUserMessage => ({
    type: 'user',
    session_id: sessionId,
    parent_tool_use_id: toolUseId,
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: errorMessage,
          is_error: true,
        },
      ],
    },
  }),
};

/**
 * Result messages (end of conversation)
 */
export const resultMessages = {
  success: (sessionId = 'test-session-1'): ClaudeCodeSDKResultMessage => ({
    type: 'result',
    subtype: 'success',
    session_id: sessionId,
    duration_ms: 5000,
    duration_api_ms: 4500,
    is_error: false,
    num_turns: 3,
    result: 'Task completed successfully',
    total_cost_usd: 0.093,
    usage,
  }),

  error: (sessionId = 'test-session-1'): ClaudeCodeSDKResultMessage => ({
    type: 'result',
    subtype: 'error_during_execution',
    session_id: sessionId,
    duration_ms: 2000,
    duration_api_ms: 1800,
    is_error: true,
    num_turns: 1,
    total_cost_usd: 0.021,
    usage,
  }),

  withHighUsage: (sessionId = 'test-session-1'): ClaudeCodeSDKResultMessage => ({
    type: 'result',
    subtype: 'success',
    session_id: sessionId,
    duration_ms: 15000,
    duration_api_ms: 14500,
    is_error: false,
    num_turns: 10,
    result: 'Complex task completed successfully',
    total_cost_usd: 0.75,
    usage,
  }),
};

/**
 * Combined fixtures for easy access
 */
export const sdkMessageFixtures = {
  systemInit: systemMessages.init,
  simpleUserMessage: userMessages.simple,
  assistantTextResponse: assistantMessages.textResponse,
  assistantWithThinking: assistantMessages.withThinking,
  assistantWithCitations: assistantMessages.withCitations,
  assistantWithWebSearch: assistantMessages.withWebSearch,
  assistantWithRedactedThinking: assistantMessages.withRedactedThinking,
  assistantFileRead: assistantMessages.fileRead,
  assistantFileWrite: assistantMessages.fileWrite,
  assistantBashCommand: assistantMessages.bashCommand,
  toolResultBash: toolResultMessages.bashResult,
  toolResultFile: toolResultMessages.fileResult,
  toolResultError: toolResultMessages.errorResult,
  resultSuccess: resultMessages.success,
  resultError: resultMessages.error,
};

/**
 * Example conversation flows
 */
export const conversationFixtures = {
  simpleFlow: (sessionId = 'test-session-1') => [
    systemMessages.init(sessionId),
    userMessages.simple('Hello, can you help me with a task?', sessionId),
    assistantMessages.textResponse(
      "Hello! I'd be happy to help. What can I do for you?",
      sessionId,
    ),
  ],

  toolFlow: (sessionId = 'test-session-1') => {
    const toolUseId = `tool-read-${Date.now()}`;
    return [
      systemMessages.init(sessionId),
      userMessages.simple('Can you read the package.json file?', sessionId),
      assistantMessages.withToolUse(
        "I'll read the package.json file for you.",
        'read',
        { file_path: './package.json' },
        sessionId,
      ),
      toolResultMessages.fileResult(
        toolUseId,
        '{"name": "test-project", "version": "1.0.0"}',
        sessionId,
      ),
      assistantMessages.textResponse(
        'I can see this is a test project with version 1.0.0.',
        sessionId,
      ),
      resultMessages.success(sessionId),
    ];
  },

  errorFlow: (sessionId = 'test-session-1') => {
    const toolUseId = `tool-bash-${Date.now()}`;
    return [
      systemMessages.init(sessionId),
      userMessages.simple('Run ls on a non-existent directory', sessionId),
      assistantMessages.bashCommand(
        'ls /non/existent/directory',
        "I'll list the contents of that directory.",
        sessionId,
      ),
      toolResultMessages.errorResult(
        toolUseId,
        'ls: /non/existent/directory: No such file or directory',
        sessionId,
      ),
      resultMessages.error(sessionId),
    ];
  },
};
