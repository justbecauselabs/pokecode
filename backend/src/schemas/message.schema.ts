import { type Static, Type } from '@sinclair/typebox';

// Base message role enum
export const MessageRoleSchema = Type.Union([Type.Literal('user'), Type.Literal('assistant')]);

// Tool call schema for nested messages
export const ToolCallSchema = Type.Object({
  name: Type.String(),
  input: Type.Any(),
});

// Tool result schema for nested messages
export const ToolResultSchema = Type.Object({
  tool_use_id: Type.String(),
  content: Type.String(),
});

// Main API message schema (flattened messages with tool data)
export const ApiMessageSchema = Type.Object({
  id: Type.String(),
  sessionId: Type.String(),
  role: MessageRoleSchema,
  content: Type.String(),
  timestamp: Type.String(),
  toolCalls: Type.Optional(Type.Array(ToolCallSchema)),
  toolResults: Type.Optional(Type.Array(ToolResultSchema)),
  thinking: Type.Optional(Type.String()),
});

// Request body for creating a message
export const CreateMessageBodySchema = Type.Object({
  content: Type.String({ minLength: 1 }),
  allowedTools: Type.Optional(Type.Array(Type.String())),
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
