import { type Static, Type } from '@sinclair/typebox';

// Base message role enum - expanded to include system messages
export const MessageRoleSchema = Type.Union([
  Type.Literal('user'),
  Type.Literal('assistant'),
  Type.Literal('system'),
]);

// Message type enum - covers all SDK message types
export const MessageTypeSchema = Type.Union([
  Type.Literal('user'),
  Type.Literal('assistant'),
  Type.Literal('system'),
  Type.Literal('result'),
]);

// Tool call schema for nested messages
export const ToolCallSchema = Type.Object({
  id: Type.Optional(Type.String()), // Tool use ID for linking
  name: Type.String(),
  input: Type.Any(),
});

// Tool result schema for nested messages
export const ToolResultSchema = Type.Object({
  toolUseId: Type.String(),
  content: Type.String(),
  isError: Type.Optional(Type.Boolean()),
});

// Citation schema for text with citations
export const CitationSchema = Type.Object({
  type: Type.Union([
    Type.Literal('char_location'),
    Type.Literal('page_location'),
    Type.Literal('content_block_location'),
    Type.Literal('web_search_result_location'),
    Type.Literal('search_result_location'),
  ]),
  citedText: Type.String(),
  documentIndex: Type.Optional(Type.Number()),
  documentTitle: Type.Optional(Type.String()),
  fileId: Type.Optional(Type.String()),
  startCharIndex: Type.Optional(Type.Number()),
  endCharIndex: Type.Optional(Type.Number()),
  startPageNumber: Type.Optional(Type.Number()),
  endPageNumber: Type.Optional(Type.Number()),
  startBlockIndex: Type.Optional(Type.Number()),
  endBlockIndex: Type.Optional(Type.Number()),
  url: Type.Optional(Type.String()),
  encryptedIndex: Type.Optional(Type.String()),
  searchResultIndex: Type.Optional(Type.Number()),
  source: Type.Optional(Type.String()),
  title: Type.Optional(Type.String()),
});

// Web search result schema
export const WebSearchResultSchema = Type.Object({
  type: Type.Literal('web_search_result'),
  url: Type.String(),
  title: Type.String(),
  encryptedContent: Type.String(),
  pageAge: Type.Optional(Type.String()),
});

// Usage metadata schema
export const UsageSchema = Type.Object({
  inputTokens: Type.Number(),
  outputTokens: Type.Number(),
  cacheCreationInputTokens: Type.Optional(Type.Number()),
  cacheReadInputTokens: Type.Optional(Type.Number()),
  serviceTier: Type.Optional(
    Type.Union([
      Type.Literal('standard'),
      Type.Literal('priority'),
      Type.Literal('batch'),
      Type.Null(),
    ]),
  ),
});

// System message metadata schema
export const SystemMessageMetadataSchema = Type.Object({
  cwd: Type.Optional(Type.String()),
  tools: Type.Optional(Type.Array(Type.String())),
  mcpServers: Type.Optional(
    Type.Array(
      Type.Object({
        name: Type.String(),
        status: Type.String(),
      }),
    ),
  ),
  model: Type.Optional(Type.String()),
  permissionMode: Type.Optional(Type.String()),
  slashCommands: Type.Optional(Type.Array(Type.String())),
  apiKeySource: Type.Optional(Type.String()),
});

// Result message metadata schema
export const ResultMessageMetadataSchema = Type.Object({
  subtype: Type.Union([
    Type.Literal('success'),
    Type.Literal('error_max_turns'),
    Type.Literal('error_during_execution'),
  ]),
  durationMs: Type.Optional(Type.Number()),
  durationApiMs: Type.Optional(Type.Number()),
  isError: Type.Optional(Type.Boolean()),
  numTurns: Type.Optional(Type.Number()),
  result: Type.Optional(Type.String()),
  totalCostUsd: Type.Optional(Type.Number()),
  usage: Type.Optional(UsageSchema),
});

// Main API message schema (flattened messages with tool data)
export const ApiMessageSchema = Type.Object({
  id: Type.String(),
  sessionId: Type.String(),
  role: MessageRoleSchema,
  content: Type.String(),
  timestamp: Type.String(),

  // Content-specific fields
  toolCalls: Type.Optional(Type.Array(ToolCallSchema)),
  toolResults: Type.Optional(Type.Array(ToolResultSchema)),
  thinking: Type.Optional(Type.String()),
  citations: Type.Optional(Type.Array(CitationSchema)),
  webSearchResults: Type.Optional(Type.Array(WebSearchResultSchema)),

  // Message metadata
  messageType: Type.Optional(MessageTypeSchema),
  model: Type.Optional(Type.String()),
  stopReason: Type.Optional(
    Type.Union([
      Type.Literal('end_turn'),
      Type.Literal('max_tokens'),
      Type.Literal('stop_sequence'),
      Type.Literal('tool_use'),
      Type.Literal('pause_turn'),
      Type.Literal('refusal'),
      Type.Null(),
    ]),
  ),
  stopSequence: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  usage: Type.Optional(UsageSchema),

  // System message specific
  systemMetadata: Type.Optional(SystemMessageMetadataSchema),

  // Result message specific
  resultMetadata: Type.Optional(ResultMessageMetadataSchema),

  // SDK session tracking
  claudeSessionId: Type.Optional(Type.String()),
  parentToolUseId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

// Request body for creating a message
export const CreateMessageBodySchema = Type.Object({
  content: Type.String({ minLength: 1 }),
  allowedTools: Type.Optional(Type.Array(Type.String())),
  agent: Type.Optional(Type.String({ description: 'Agent name to use for this message' })),
});

// Response schemas
export const CreateMessageResponseSchema = Type.Object({
  message: ApiMessageSchema,
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
  messages: Type.Array(ApiMessageSchema),
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
export type ApiMessage = Static<typeof ApiMessageSchema>;
export type SessionInfo = Static<typeof SessionInfoSchema>;
export type CreateMessageRequest = Static<typeof CreateMessageBodySchema>;
export type CreateMessageResponse = Static<typeof CreateMessageResponseSchema>;
export type GetMessagesResponse = Static<typeof GetMessagesResponseSchema>;
