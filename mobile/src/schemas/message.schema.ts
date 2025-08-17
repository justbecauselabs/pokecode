import { z } from 'zod';
import { SessionSchema } from './session.schema';

export const MessageTypeSchema = z.enum(['assistant', 'user', 'system', 'result']);

// Tool result content block schema (maps to ToolResultBlockParam from SDK)
export const ToolResultContentBlockSchema = z.object({
  toolUseId: z.string(),
  type: z.literal('tool_result'),
  content: z.string(),
  isError: z.boolean().optional(),
});

export const UserMessageSchema = z.object({
  content: z.string(),
});

export const AssistantMessageTypeSchema = z.enum(['message', 'tool_use', 'tool_result']);

export const AssistantMessageMessageSchema = z.object({
  content: z.string(),
});

// Tool result type schema
export const ToolTypeSchema = z.enum(['todo', 'read', 'bash', 'edit']);

// Todo tool use schema
export const TodoToolUseSchema = z.object({
  todoId: z.string(),
  todos: z.array(
    z.object({
      content: z.string(),
      status: z.enum(['pending', 'in_progress', 'completed']),
    }),
  ),
});

// Read tool use schema
export const ReadToolUseSchema = z.object({
  readId: z.string(),
  filePath: z.string(),
});

// Bash tool use schema
export const BashToolUseSchema = z.object({
  todoId: z.string(),
  command: z.string(),
  timeout: z.number().optional(),
  description: z.string().optional(),
});

// Edit tool use schema
export const EditToolUseSchema = z.object({
  toolId: z.string(),
  filePath: z.string(),
  oldString: z.string(),
  newString: z.string(),
});

// Tool use schema with nested tool_result_type
export const AssistantMessageToolUseSchema = z.object({
  type: ToolTypeSchema,
  data: z.union([TodoToolUseSchema, ReadToolUseSchema, BashToolUseSchema, EditToolUseSchema]),
});

// Tool result schema for assistant messages
export const AssistantMessageToolResultSchema = z.object({
  toolUseId: z.string(),
  content: z.string(),
  isError: z.boolean().optional(),
});

export const AssistantMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('message'),
    data: AssistantMessageMessageSchema,
  }),
  z.object({
    type: z.literal('tool_use'),
    data: AssistantMessageToolUseSchema,
  }),
  z.object({
    type: z.literal('tool_result'),
    data: AssistantMessageToolResultSchema,
  }),
]);

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
export type ToolResultContentBlock = z.infer<typeof ToolResultContentBlockSchema>;
export type UserMessage = z.infer<typeof UserMessageSchema>;
export type AssistantMessageType = z.infer<typeof AssistantMessageTypeSchema>;
export type AssistantMessageMessage = z.infer<typeof AssistantMessageMessageSchema>;
export type ToolResultType = z.infer<typeof ToolTypeSchema>;
export type TodoToolUse = z.infer<typeof TodoToolUseSchema>;
export type ReadToolUse = z.infer<typeof ReadToolUseSchema>;
export type BashToolUse = z.infer<typeof BashToolUseSchema>;
export type EditToolUse = z.infer<typeof EditToolUseSchema>;
export type AssistantMessageToolUse = z.infer<typeof AssistantMessageToolUseSchema>;
export type AssistantMessageToolResult = z.infer<typeof AssistantMessageToolResultSchema>;
export type AssistantMessage = z.infer<typeof AssistantMessageSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type CreateMessageRequest = z.infer<typeof CreateMessageBodySchema>;
export type CreateMessageResponse = z.infer<typeof CreateMessageResponseSchema>;
export type GetMessagesResponse = z.infer<typeof GetMessagesResponseSchema>;
export type SessionInfo = z.infer<typeof SessionSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type SessionIdParams = z.infer<typeof SessionIdParamsSchema>;
