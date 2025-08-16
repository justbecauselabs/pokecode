import { z } from 'zod';

// Claude Code SDK Message Types (from the spec)

// API Key Source
export const ClaudeCodeApiKeySourceSchema = z.enum([
  'user',
  'project',
  'org',
  'temporary',
  'none', // Added for actual SDK compatibility
]);

// Permission Mode
export const ClaudeCodePermissionModeSchema = z.enum([
  'default',
  'acceptEdits',
  'bypassPermissions',
  'plan',
]);

// Model types
export const ClaudeCodeModelSchema = z.union([
  z.literal('claude-3-7-sonnet-latest'),
  z.literal('claude-3-7-sonnet-20250219'),
  z.literal('claude-3-5-haiku-latest'),
  z.literal('claude-3-5-haiku-20241022'),
  z.literal('claude-sonnet-4-20250514'),
  z.literal('claude-sonnet-4-0'),
  z.literal('claude-4-sonnet-20250514'),
  z.literal('claude-3-5-sonnet-latest'),
  z.literal('claude-3-5-sonnet-20241022'),
  z.literal('claude-3-5-sonnet-20240620'),
  z.literal('claude-opus-4-0'),
  z.literal('claude-opus-4-20250514'),
  z.literal('claude-4-opus-20250514'),
  z.literal('claude-opus-4-1-20250805'),
  z.literal('claude-3-opus-latest'),
  z.literal('claude-3-opus-20240229'),
  z.literal('claude-3-haiku-20240307'),
  z.string(),
]);

// Stop Reason
export const ClaudeCodeStopReasonSchema = z.union([
  z.literal('end_turn'),
  z.literal('max_tokens'),
  z.literal('stop_sequence'),
  z.literal('tool_use'),
  z.literal('pause_turn'),
  z.literal('refusal'),
  z.null(),
]);

// Usage
export const ClaudeCodeCacheCreationSchema = z.object({
  ephemeral_1h_input_tokens: z.number(),
  ephemeral_5m_input_tokens: z.number(),
});

export const ClaudeCodeServerToolUsageSchema = z.object({
  web_search_requests: z.number(),
});

export const ClaudeCodeUsageSchema = z.object({
  cache_creation: z.union([ClaudeCodeCacheCreationSchema, z.null()]),
  cache_creation_input_tokens: z.union([z.number(), z.null()]),
  cache_read_input_tokens: z.union([z.number(), z.null()]),
  input_tokens: z.number(),
  output_tokens: z.number(),
  server_tool_use: z.union([ClaudeCodeServerToolUsageSchema, z.null()]).optional(),
  service_tier: z.union([
    z.literal('standard'),
    z.literal('priority'),
    z.literal('batch'),
    z.null(),
  ]),
});

export const ClaudeCodeNonNullableUsageSchema = z.object({
  cache_creation_input_tokens: z.number(),
  cache_read_input_tokens: z.number(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  server_tool_use: ClaudeCodeServerToolUsageSchema,
  service_tier: z.union([z.literal('standard'), z.literal('priority'), z.literal('batch')]),
});

// Content Blocks
export const ClaudeCodeTextCitationSchema = z.union([
  z.object({
    type: z.literal('char_location'),
    cited_text: z.string(),
    document_index: z.number(),
    document_title: z.union([z.string(), z.null()]),
    end_char_index: z.number(),
    file_id: z.union([z.string(), z.null()]),
    start_char_index: z.number(),
  }),
  z.object({
    type: z.literal('page_location'),
    cited_text: z.string(),
    document_index: z.number(),
    document_title: z.union([z.string(), z.null()]),
    end_page_number: z.number(),
    file_id: z.union([z.string(), z.null()]),
    start_page_number: z.number(),
  }),
  z.object({
    type: z.literal('content_block_location'),
    cited_text: z.string(),
    document_index: z.number(),
    document_title: z.union([z.string(), z.null()]),
    end_block_index: z.number(),
    file_id: z.union([z.string(), z.null()]),
    start_block_index: z.number(),
  }),
  z.object({
    type: z.literal('web_search_result_location'),
    cited_text: z.string(),
    encrypted_index: z.string(),
    title: z.union([z.string(), z.null()]),
    url: z.string(),
  }),
  z.object({
    type: z.literal('search_result_location'),
    cited_text: z.string(),
    end_block_index: z.number(),
    search_result_index: z.number(),
    source: z.string(),
    start_block_index: z.number(),
    title: z.union([z.string(), z.null()]),
  }),
]);

export const ClaudeCodeTextBlockSchema = z.object({
  citations: z.union([z.array(ClaudeCodeTextCitationSchema), z.null()]).optional(),
  text: z.string(),
  type: z.literal('text'),
});

export const ClaudeCodeThinkingBlockSchema = z.object({
  signature: z.string(),
  thinking: z.string(),
  type: z.literal('thinking'),
});

export const ClaudeCodeRedactedThinkingBlockSchema = z.object({
  data: z.string(),
  type: z.literal('redacted_thinking'),
});

export const ClaudeCodeToolUseBlockSchema = z.object({
  id: z.string(),
  input: z.any(),
  name: z.string(),
  type: z.literal('tool_use'),
});

export const ClaudeCodeServerToolUseBlockSchema = z.object({
  id: z.string(),
  input: z.any(),
  name: z.literal('web_search'),
  type: z.literal('server_tool_use'),
});

export const ClaudeCodeWebSearchToolResultBlockSchema = z.object({
  content: z.any(), // WebSearchToolResultBlockContent - complex union type
  tool_use_id: z.string(),
  type: z.literal('web_search_tool_result'),
});

export const ClaudeCodeContentBlockSchema = z.union([
  ClaudeCodeTextBlockSchema,
  ClaudeCodeThinkingBlockSchema,
  ClaudeCodeRedactedThinkingBlockSchema,
  ClaudeCodeToolUseBlockSchema,
  ClaudeCodeServerToolUseBlockSchema,
  ClaudeCodeWebSearchToolResultBlockSchema,
]);

// API Message Types
export const ClaudeCodeAPIAssistantMessageSchema = z.object({
  id: z.string(),
  content: z.array(ClaudeCodeContentBlockSchema),
  model: ClaudeCodeModelSchema,
  role: z.literal('assistant'),
  stop_reason: z.union([ClaudeCodeStopReasonSchema, z.null()]),
  stop_sequence: z.union([z.string(), z.null()]),
  type: z.literal('message'),
  usage: ClaudeCodeUsageSchema,
});

export const ClaudeCodeAPIUserMessageSchema = z.object({
  content: z.union([z.string(), z.array(z.any())]), // ContentBlockParam array
  role: z.union([z.literal('user'), z.literal('assistant')]),
});

// SDK Message Types
export const ClaudeCodeSDKAssistantMessageSchema = z.object({
  type: z.literal('assistant'),
  message: ClaudeCodeAPIAssistantMessageSchema,
  parent_tool_use_id: z.union([z.string(), z.null()]),
  session_id: z.string(),
});

export const ClaudeCodeSDKUserMessageSchema = z.object({
  type: z.literal('user'),
  message: ClaudeCodeAPIUserMessageSchema,
  parent_tool_use_id: z.union([z.string(), z.null()]),
  session_id: z.string(),
});

export const ClaudeCodeSDKResultMessageSchema = z.union([
  z.object({
    type: z.literal('result'),
    subtype: z.literal('success'),
    duration_ms: z.number(),
    duration_api_ms: z.number(),
    is_error: z.boolean(),
    num_turns: z.number(),
    permission_denials: z.array(z.object({})),
    result: z.string(),
    session_id: z.string(),
    total_cost_usd: z.number(),
    usage: ClaudeCodeNonNullableUsageSchema,
  }),
  z.object({
    type: z.literal('result'),
    subtype: z.union([z.literal('error_max_turns'), z.literal('error_during_execution')]),
    duration_ms: z.number(),
    duration_api_ms: z.number(),
    is_error: z.boolean(),
    num_turns: z.number(),
    permission_denials: z.array(z.object({})),
    session_id: z.string(),
    total_cost_usd: z.number(),
    usage: ClaudeCodeNonNullableUsageSchema,
  }),
]);

export const ClaudeCodeSDKSystemMessageSchema = z.object({
  type: z.literal('system'),
  subtype: z.literal('init'),
  apiKeySource: ClaudeCodeApiKeySourceSchema,
  cwd: z.string(),
  session_id: z.string(),
  tools: z.array(z.string()),
  mcp_servers: z.array(
    z.object({
      name: z.string(),
      status: z.string(),
    }),
  ),
  model: z.string(),
  permissionMode: ClaudeCodePermissionModeSchema,
  slash_commands: z.array(z.string()),
});

// Original strict schema restored
export const ClaudeCodeSDKMessageSchema = z.union([
  ClaudeCodeSDKAssistantMessageSchema,
  ClaudeCodeSDKUserMessageSchema,
  ClaudeCodeSDKResultMessageSchema,
  ClaudeCodeSDKSystemMessageSchema,
]);

// Main Message Schema - wrapper around Claude Code SDK content
export const MessageSchema = z.object({
  id: z.string(), // DB message ID
  type: z.literal('claude-code'), // Hardcoded type
  data: ClaudeCodeSDKMessageSchema, // Claude Code SDK content
});

// Request body for creating a message
export const CreateMessageBodySchema = z.object({
  content: z.string().min(1),
  allowedTools: z.array(z.string()).optional(),
  agent: z.string().describe('Agent name to use for this message').optional(),
});

// Response schemas
export const CreateMessageResponseSchema = z.object({
  message: MessageSchema,
});

// Session info schema for response
export const SessionInfoSchema = z.object({
  id: z.string(),
  projectPath: z.string(),
  name: z.string(),
  claudeDirectoryPath: z.string().optional(),
  context: z.string().nullable().optional(),
  status: z.union([z.literal('active'), z.literal('idle'), z.literal('expired')]),
  metadata: z.any().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastAccessedAt: z.string().datetime(),
  // Working state fields
  isWorking: z.boolean(),
  currentJobId: z.union([z.string(), z.null()]).optional(),
  lastJobStatus: z.union([z.string(), z.null()]).optional(),
  // Token and message tracking
  messageCount: z.number().int().min(0).default(0),
  tokenCount: z.number().int().min(0).default(0),
});

export const GetMessagesResponseSchema = z.object({
  messages: z.array(MessageSchema),
  session: SessionInfoSchema,
});

// Error response schema
export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});

// Params schema
export const SessionIdParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

// Export TypeScript types derived from schemas
export type Message = z.infer<typeof MessageSchema>;
export type ClaudeCodeSDKMessage = z.infer<typeof ClaudeCodeSDKMessageSchema>;
export type ClaudeCodeSDKAssistantMessage = z.infer<typeof ClaudeCodeSDKAssistantMessageSchema>;
export type ClaudeCodeSDKUserMessage = z.infer<typeof ClaudeCodeSDKUserMessageSchema>;
export type ClaudeCodeSDKResultMessage = z.infer<typeof ClaudeCodeSDKResultMessageSchema>;
export type ClaudeCodeSDKSystemMessage = z.infer<typeof ClaudeCodeSDKSystemMessageSchema>;
export type ClaudeCodeAPIAssistantMessage = z.infer<typeof ClaudeCodeAPIAssistantMessageSchema>;
export type ClaudeCodeAPIUserMessage = z.infer<typeof ClaudeCodeAPIUserMessageSchema>;
export type SessionInfo = z.infer<typeof SessionInfoSchema>;
export type CreateMessageRequest = z.infer<typeof CreateMessageBodySchema>;
export type CreateMessageResponse = z.infer<typeof CreateMessageResponseSchema>;
export type GetMessagesResponse = z.infer<typeof GetMessagesResponseSchema>;
