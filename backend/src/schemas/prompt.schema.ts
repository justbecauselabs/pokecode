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

export const PromptResponseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  sessionId: Type.String({ format: 'uuid' }),
  prompt: Type.String(),
  status: Type.Union([
    Type.Literal('queued'),
    Type.Literal('processing'),
    Type.Literal('completed'),
    Type.Literal('failed'),
    Type.Literal('cancelled'),
  ]),
  jobId: Type.Optional(Type.String()),
  createdAt: Type.String({ format: 'date-time' }),
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

// History query schema
export const HistoryQuerySchema = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
  includeToolCalls: Type.Optional(Type.Boolean({ default: false })),
});

export const HistoryResponseSchema = Type.Object({
  prompts: Type.Array(
    Type.Object({
      id: Type.String(),
      prompt: Type.String(),
      response: Type.Optional(Type.String()),
      status: Type.String(),
      metadata: Type.Optional(Type.Any()),
      createdAt: Type.String(),
      completedAt: Type.Optional(Type.String()),
    }),
  ),
  total: Type.Integer(),
  limit: Type.Integer(),
  offset: Type.Integer(),
});

// Export query schema
export const ExportQuerySchema = Type.Object({
  format: Type.Union([Type.Literal('markdown'), Type.Literal('json')]),
  includeFiles: Type.Optional(Type.Boolean({ default: false })),
});

// Type exports
export type CreatePromptRequest = Static<typeof CreatePromptRequestSchema>;
export type PromptResponse = Static<typeof PromptResponseSchema>;
export type PromptDetailResponse = Static<typeof PromptDetailResponseSchema>;
export type PromptParams = Static<typeof PromptParamsSchema>;
export type HistoryQuery = Static<typeof HistoryQuerySchema>;
export type HistoryResponse = Static<typeof HistoryResponseSchema>;
export type ExportQuery = Static<typeof ExportQuerySchema>;
