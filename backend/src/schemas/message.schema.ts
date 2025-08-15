import { type Static, Type } from '@sinclair/typebox';

// Claude Code SDK Message Types (from the spec)

// API Key Source
export const ClaudeCodeApiKeySourceSchema = Type.Union([
  Type.Literal('user'),
  Type.Literal('project'),
  Type.Literal('org'),
  Type.Literal('temporary'),
  Type.Literal('none'), // Added for actual SDK compatibility
]);

// Permission Mode
export const ClaudeCodePermissionModeSchema = Type.Union([
  Type.Literal('default'),
  Type.Literal('acceptEdits'),
  Type.Literal('bypassPermissions'),
  Type.Literal('plan'),
]);

// Model types
export const ClaudeCodeModelSchema = Type.Union([
  Type.Literal('claude-3-7-sonnet-latest'),
  Type.Literal('claude-3-7-sonnet-20250219'),
  Type.Literal('claude-3-5-haiku-latest'),
  Type.Literal('claude-3-5-haiku-20241022'),
  Type.Literal('claude-sonnet-4-20250514'),
  Type.Literal('claude-sonnet-4-0'),
  Type.Literal('claude-4-sonnet-20250514'),
  Type.Literal('claude-3-5-sonnet-latest'),
  Type.Literal('claude-3-5-sonnet-20241022'),
  Type.Literal('claude-3-5-sonnet-20240620'),
  Type.Literal('claude-opus-4-0'),
  Type.Literal('claude-opus-4-20250514'),
  Type.Literal('claude-4-opus-20250514'),
  Type.Literal('claude-opus-4-1-20250805'),
  Type.Literal('claude-3-opus-latest'),
  Type.Literal('claude-3-opus-20240229'),
  Type.Literal('claude-3-haiku-20240307'),
  Type.String(),
]);

// Stop Reason
export const ClaudeCodeStopReasonSchema = Type.Union([
  Type.Literal('end_turn'),
  Type.Literal('max_tokens'),
  Type.Literal('stop_sequence'),
  Type.Literal('tool_use'),
  Type.Literal('pause_turn'),
  Type.Literal('refusal'),
  Type.Null(),
]);

// Usage
export const ClaudeCodeCacheCreationSchema = Type.Object({
  ephemeral_1h_input_tokens: Type.Number(),
  ephemeral_5m_input_tokens: Type.Number(),
});

export const ClaudeCodeServerToolUsageSchema = Type.Object({
  web_search_requests: Type.Number(),
});

export const ClaudeCodeUsageSchema = Type.Object({
  cache_creation: Type.Union([ClaudeCodeCacheCreationSchema, Type.Null()]),
  cache_creation_input_tokens: Type.Union([Type.Number(), Type.Null()]),
  cache_read_input_tokens: Type.Union([Type.Number(), Type.Null()]),
  input_tokens: Type.Number(),
  output_tokens: Type.Number(),
  server_tool_use: Type.Optional(Type.Union([ClaudeCodeServerToolUsageSchema, Type.Null()])),
  service_tier: Type.Union([
    Type.Literal('standard'),
    Type.Literal('priority'),
    Type.Literal('batch'),
    Type.Null(),
  ]),
});

export const ClaudeCodeNonNullableUsageSchema = Type.Object({
  cache_creation: ClaudeCodeCacheCreationSchema,
  cache_creation_input_tokens: Type.Number(),
  cache_read_input_tokens: Type.Number(),
  input_tokens: Type.Number(),
  output_tokens: Type.Number(),
  server_tool_use: ClaudeCodeServerToolUsageSchema,
  service_tier: Type.Union([
    Type.Literal('standard'),
    Type.Literal('priority'),
    Type.Literal('batch'),
  ]),
});

// Content Blocks
export const ClaudeCodeTextCitationSchema = Type.Union([
  Type.Object({
    type: Type.Literal('char_location'),
    cited_text: Type.String(),
    document_index: Type.Number(),
    document_title: Type.Union([Type.String(), Type.Null()]),
    end_char_index: Type.Number(),
    file_id: Type.Union([Type.String(), Type.Null()]),
    start_char_index: Type.Number(),
  }),
  Type.Object({
    type: Type.Literal('page_location'),
    cited_text: Type.String(),
    document_index: Type.Number(),
    document_title: Type.Union([Type.String(), Type.Null()]),
    end_page_number: Type.Number(),
    file_id: Type.Union([Type.String(), Type.Null()]),
    start_page_number: Type.Number(),
  }),
  Type.Object({
    type: Type.Literal('content_block_location'),
    cited_text: Type.String(),
    document_index: Type.Number(),
    document_title: Type.Union([Type.String(), Type.Null()]),
    end_block_index: Type.Number(),
    file_id: Type.Union([Type.String(), Type.Null()]),
    start_block_index: Type.Number(),
  }),
  Type.Object({
    type: Type.Literal('web_search_result_location'),
    cited_text: Type.String(),
    encrypted_index: Type.String(),
    title: Type.Union([Type.String(), Type.Null()]),
    url: Type.String(),
  }),
  Type.Object({
    type: Type.Literal('search_result_location'),
    cited_text: Type.String(),
    end_block_index: Type.Number(),
    search_result_index: Type.Number(),
    source: Type.String(),
    start_block_index: Type.Number(),
    title: Type.Union([Type.String(), Type.Null()]),
  }),
]);

export const ClaudeCodeTextBlockSchema = Type.Object({
  citations: Type.Union([Type.Array(ClaudeCodeTextCitationSchema), Type.Null()]),
  text: Type.String(),
  type: Type.Literal('text'),
});

export const ClaudeCodeThinkingBlockSchema = Type.Object({
  signature: Type.String(),
  thinking: Type.String(),
  type: Type.Literal('thinking'),
});

export const ClaudeCodeRedactedThinkingBlockSchema = Type.Object({
  data: Type.String(),
  type: Type.Literal('redacted_thinking'),
});

export const ClaudeCodeToolUseBlockSchema = Type.Object({
  id: Type.String(),
  input: Type.Any(),
  name: Type.String(),
  type: Type.Literal('tool_use'),
});

export const ClaudeCodeServerToolUseBlockSchema = Type.Object({
  id: Type.String(),
  input: Type.Any(),
  name: Type.Literal('web_search'),
  type: Type.Literal('server_tool_use'),
});

export const ClaudeCodeWebSearchToolResultBlockSchema = Type.Object({
  content: Type.Any(), // WebSearchToolResultBlockContent - complex union type
  tool_use_id: Type.String(),
  type: Type.Literal('web_search_tool_result'),
});

export const ClaudeCodeContentBlockSchema = Type.Union([
  ClaudeCodeTextBlockSchema,
  ClaudeCodeThinkingBlockSchema,
  ClaudeCodeRedactedThinkingBlockSchema,
  ClaudeCodeToolUseBlockSchema,
  ClaudeCodeServerToolUseBlockSchema,
  ClaudeCodeWebSearchToolResultBlockSchema,
]);

// API Message Types
export const ClaudeCodeAPIAssistantMessageSchema = Type.Object({
  id: Type.String(),
  content: Type.Array(ClaudeCodeContentBlockSchema),
  model: ClaudeCodeModelSchema,
  role: Type.Literal('assistant'),
  stop_reason: Type.Union([ClaudeCodeStopReasonSchema, Type.Null()]),
  stop_sequence: Type.Union([Type.String(), Type.Null()]),
  type: Type.Literal('message'),
  usage: ClaudeCodeUsageSchema,
});

export const ClaudeCodeAPIUserMessageSchema = Type.Object({
  content: Type.Union([Type.String(), Type.Array(Type.Any())]), // ContentBlockParam array
  role: Type.Union([Type.Literal('user'), Type.Literal('assistant')]),
});

// SDK Message Types
export const ClaudeCodeSDKAssistantMessageSchema = Type.Object({
  type: Type.Literal('assistant'),
  message: ClaudeCodeAPIAssistantMessageSchema,
  parent_tool_use_id: Type.Union([Type.String(), Type.Null()]),
  session_id: Type.String(),
});

export const ClaudeCodeSDKUserMessageSchema = Type.Object({
  type: Type.Literal('user'),
  message: ClaudeCodeAPIUserMessageSchema,
  parent_tool_use_id: Type.Union([Type.String(), Type.Null()]),
  session_id: Type.String(),
});

export const ClaudeCodeSDKResultMessageSchema = Type.Union([
  Type.Object({
    type: Type.Literal('result'),
    subtype: Type.Literal('success'),
    duration_ms: Type.Number(),
    duration_api_ms: Type.Number(),
    is_error: Type.Boolean(),
    num_turns: Type.Number(),
    result: Type.String(),
    session_id: Type.String(),
    total_cost_usd: Type.Number(),
    usage: ClaudeCodeNonNullableUsageSchema,
  }),
  Type.Object({
    type: Type.Literal('result'),
    subtype: Type.Union([Type.Literal('error_max_turns'), Type.Literal('error_during_execution')]),
    duration_ms: Type.Number(),
    duration_api_ms: Type.Number(),
    is_error: Type.Boolean(),
    num_turns: Type.Number(),
    session_id: Type.String(),
    total_cost_usd: Type.Number(),
    usage: ClaudeCodeNonNullableUsageSchema,
  }),
]);

export const ClaudeCodeSDKSystemMessageSchema = Type.Object({
  type: Type.Literal('system'),
  subtype: Type.Literal('init'),
  apiKeySource: ClaudeCodeApiKeySourceSchema,
  cwd: Type.String(),
  session_id: Type.String(),
  tools: Type.Array(Type.String()),
  mcp_servers: Type.Array(
    Type.Object({
      name: Type.String(),
      status: Type.String(),
    }),
  ),
  model: Type.String(),
  permissionMode: ClaudeCodePermissionModeSchema,
  slash_commands: Type.Array(Type.String()),
});

// Temporarily using a more permissive schema for debugging
export const ClaudeCodeSDKMessageSchema = Type.Object({
  type: Type.Union([
    Type.Literal('assistant'),
    Type.Literal('user'),
    Type.Literal('result'),
    Type.Literal('system'),
  ]),
}, { additionalProperties: true }); // Allow additional properties

// Original strict schema - temporarily commented out for debugging
// export const ClaudeCodeSDKMessageSchema = Type.Union([
//   ClaudeCodeSDKAssistantMessageSchema,
//   ClaudeCodeSDKUserMessageSchema,
//   ClaudeCodeSDKResultMessageSchema,
//   ClaudeCodeSDKSystemMessageSchema,
// ]);

// Main Message Schema - wrapper around Claude Code SDK content
export const MessageSchema = Type.Object({
  id: Type.String(), // DB message ID
  type: Type.Literal('claude-code'), // Hardcoded type
  data: ClaudeCodeSDKMessageSchema, // Claude Code SDK content
});

// Request body for creating a message
export const CreateMessageBodySchema = Type.Object({
  content: Type.String({ minLength: 1 }),
  allowedTools: Type.Optional(Type.Array(Type.String())),
  agent: Type.Optional(Type.String({ description: 'Agent name to use for this message' })),
});

// Response schemas
export const CreateMessageResponseSchema = Type.Object({
  message: MessageSchema,
});

// Session info schema for response
export const SessionInfoSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  isWorking: Type.Boolean(),
  currentJobId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  lastJobStatus: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  status: Type.Union([Type.Literal('active'), Type.Literal('idle'), Type.Literal('expired')]),
});

export const GetMessagesResponseSchema = Type.Object({
  messages: Type.Array(MessageSchema),
  session: SessionInfoSchema,
});

// Error response schema
export const ErrorResponseSchema = Type.Object({
  error: Type.String(),
  code: Type.Optional(Type.String()),
});

// Params schema
export const SessionIdParamsSchema = Type.Object({
  sessionId: Type.String({ format: 'uuid' }),
});

// Export TypeScript types derived from schemas
export type Message = Static<typeof MessageSchema>;
export type ClaudeCodeSDKMessage = Static<typeof ClaudeCodeSDKMessageSchema>;
export type ClaudeCodeSDKAssistantMessage = Static<typeof ClaudeCodeSDKAssistantMessageSchema>;
export type ClaudeCodeSDKUserMessage = Static<typeof ClaudeCodeSDKUserMessageSchema>;
export type ClaudeCodeSDKResultMessage = Static<typeof ClaudeCodeSDKResultMessageSchema>;
export type ClaudeCodeSDKSystemMessage = Static<typeof ClaudeCodeSDKSystemMessageSchema>;
export type ClaudeCodeAPIAssistantMessage = Static<typeof ClaudeCodeAPIAssistantMessageSchema>;
export type ClaudeCodeAPIUserMessage = Static<typeof ClaudeCodeAPIUserMessageSchema>;
export type SessionInfo = Static<typeof SessionInfoSchema>;
export type CreateMessageRequest = Static<typeof CreateMessageBodySchema>;
export type CreateMessageResponse = Static<typeof CreateMessageResponseSchema>;
export type GetMessagesResponse = Static<typeof GetMessagesResponseSchema>;
