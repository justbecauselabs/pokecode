import { type Static, Type } from '@sinclair/typebox';

// Allowed tools enum
const AllowedToolsEnum = Type.Union([
  Type.Literal('Bash'),
  Type.Literal('Read'),
  Type.Literal('Write'),
  Type.Literal('Edit'),
  Type.Literal('MultiEdit'),
  Type.Literal('Glob'),
  Type.Literal('Grep'),
  Type.Literal('LS'),
  Type.Literal('WebFetch'),
  Type.Literal('WebSearch'),
  Type.Literal('TodoWrite'),
  Type.Literal('NotebookRead'),
  Type.Literal('NotebookEdit'),
]);

// Create prompt schemas
export const CreatePromptRequestSchema = Type.Object({
  prompt: Type.String({
    minLength: 1,
    maxLength: 10000,
  }),
  allowedTools: Type.Optional(Type.Array(AllowedToolsEnum)),
});

// Simplified response for creating prompts
export const PromptResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
  jobId: Type.Optional(Type.String()),
  userMessage: Type.Optional(
    Type.Object({
      id: Type.String(),
      sessionId: Type.String(),
      text: Type.String(),
      type: Type.Literal('user'),
      createdAt: Type.String(),
    }),
  ),
});

export const PromptDetailResponseSchema = Type.Intersect([
  PromptResponseSchema,
  Type.Object({
    response: Type.Optional(Type.String()),
    error: Type.Optional(Type.String()),
    metadata: Type.Optional(
      Type.Object({
        allowedTools: Type.Optional(Type.Array(Type.String())),
        toolCalls: Type.Optional(
          Type.Array(
            Type.Object({
              tool: Type.String(),
              params: Type.Any(),
              result: Type.Optional(Type.Any()),
            }),
          ),
        ),
        duration: Type.Optional(Type.Number()),
        tokenCount: Type.Optional(Type.Number()),
      }),
    ),
    completedAt: Type.Optional(Type.String({ format: 'date-time' })),
  }),
]);

// Prompt params schemas
export const PromptParamsSchema = Type.Object({
  sessionId: Type.String({ format: 'uuid' }),
  promptId: Type.String({ format: 'uuid' }),
});

// Schema for intermediate messages (child messages in the messages endpoint)
// Updated to match IntermediateMessage type from claude-messages.ts
const IntermediateMessageSchema = Type.Object({
  id: Type.String(),
  content: Type.String(),
  role: Type.Union([Type.Literal('user'), Type.Literal('assistant'), Type.Literal('system')]),
  type: Type.Optional(Type.String()),
  timestamp: Type.String({ format: 'date-time' }),
  metadata: Type.Optional(
    Type.Object({
      parentUuid: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      sessionId: Type.Optional(Type.String()),
      isSidechain: Type.Optional(Type.Boolean()),
      userType: Type.Optional(Type.String()),
      requestId: Type.Optional(Type.String()),
      toolUseResult: Type.Optional(Type.String()),
    }),
  ),
});

// Export query schema
export const ExportQuerySchema = Type.Object({
  format: Type.Union([Type.Literal('markdown'), Type.Literal('json')]),
  includeFiles: Type.Optional(Type.Boolean({ default: false })),
});

// Messages endpoint schemas
export const MessagesQuerySchema = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50 })),
  offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
});

export const MessagesResponseSchema = Type.Object({
  messages: Type.Array(
    Type.Object({
      id: Type.String({ format: 'uuid' }),
      sessionId: Type.String({ format: 'uuid' }),
      text: Type.String(),
      type: Type.Union([Type.Literal('user'), Type.Literal('assistant')]),
      claudeSessionId: Type.Optional(Type.String()),
      createdAt: Type.String({ format: 'date-time' }),
      childMessages: Type.Array(IntermediateMessageSchema), // JSONL intermediate messages
    }),
  ),
  session: Type.Object({
    id: Type.String({ format: 'uuid' }),
    isWorking: Type.Boolean(),
    currentJobId: Type.Optional(Type.String()),
    lastJobStatus: Type.Optional(Type.String()),
    status: Type.Union([
      Type.Literal('active'),
      Type.Literal('inactive'),
      Type.Literal('archived'),
    ]),
  }),
  total: Type.Integer(),
  limit: Type.Integer(),
  offset: Type.Integer(),
});

// Type exports
export type CreatePromptRequest = Static<typeof CreatePromptRequestSchema>;
export type PromptResponse = Static<typeof PromptResponseSchema>;
export type PromptDetailResponse = Static<typeof PromptDetailResponseSchema>;
export type PromptParams = Static<typeof PromptParamsSchema>;
export type ExportQuery = Static<typeof ExportQuerySchema>;
export type MessagesQuery = Static<typeof MessagesQuerySchema>;
export type MessagesResponse = Static<typeof MessagesResponseSchema>;
