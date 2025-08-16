import { z } from 'zod';
import { SessionSchema } from './session.schema';

export const MessageTypeSchema = z.enum(['assistant', 'user', 'system', 'result']);

export const UserMessageSchema = z.object({
  content: z.string(),
});

export const AssistantMessageTypeSchema = z.enum(['message', 'tool_use', 'tool_result']);

export const AssistantMessageMessageSchema = z.object({
  content: z.string(),
});

// Tool result type schema
export const ToolTypeSchema = z.enum(['todo']);

// Todo tool use schema
export const TodoToolUseSchema = z.object({
  todos: z.array(
    z.object({
      content: z.string(),
      status: z.enum(['pending', 'in_progress', 'completed']),
    }),
  ),
});

// Tool use schema with nested tool_result_type
export const AssistantMessageToolUseSchema = z.object({
  type: ToolTypeSchema,
  data: z.union([TodoToolUseSchema]),
});

export const AssistantMessageSchema = z.object({
  type: AssistantMessageTypeSchema,
  data: z.union([AssistantMessageMessageSchema, AssistantMessageToolUseSchema]),
});

export const MessageSchema = z.object({
  id: z.string(),
  type: MessageTypeSchema,
  data: z.union([UserMessageSchema, AssistantMessageSchema]),
  parentToolUseId: z.string().nullable(),
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

export const GetMessagesResponseSchema = z.object({
  messages: z.array(MessageSchema),
  session: SessionSchema,
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

export type MessageType = z.infer<typeof MessageTypeSchema>;
export type UserMessage = z.infer<typeof UserMessageSchema>;
export type AssistantMessageType = z.infer<typeof AssistantMessageTypeSchema>;
export type AssistantMessageMessage = z.infer<typeof AssistantMessageMessageSchema>;
export type ToolResultType = z.infer<typeof ToolTypeSchema>;
export type TodoToolUse = z.infer<typeof TodoToolUseSchema>;
export type AssistantMessageToolUse = z.infer<typeof AssistantMessageToolUseSchema>;
export type AssistantMessage = z.infer<typeof AssistantMessageSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type CreateMessageRequest = z.infer<typeof CreateMessageBodySchema>;
export type CreateMessageResponse = z.infer<typeof CreateMessageResponseSchema>;
export type GetMessagesResponse = z.infer<typeof GetMessagesResponseSchema>;
export type SessionInfo = z.infer<typeof SessionSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type SessionIdParams = z.infer<typeof SessionIdParamsSchema>;
