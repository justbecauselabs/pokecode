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
export const ToolTypeSchema = z.enum([
  'todo',
  'read',
  'bash',
  'edit',
  'multiedit',
  'task',
  'grep',
  'glob',
  'ls',
]);

// Todo tool use data schema (nested data part)
export const TodoToolUseDataSchema = z.object({
  todos: z.array(
    z.object({
      content: z.string(),
      status: z.enum(['pending', 'in_progress', 'completed']),
    }),
  ),
});

// Read tool use data schema (nested data part)
export const ReadToolUseDataSchema = z.object({
  filePath: z.string(),
});

// Bash tool use data schema (nested data part)
export const BashToolUseDataSchema = z.object({
  command: z.string(),
  timeout: z.number().optional(),
  description: z.string().optional(),
});

// Edit tool use data schema (nested data part)
export const EditToolUseDataSchema = z.object({
  filePath: z.string(),
  oldString: z.string(),
  newString: z.string(),
});

// MultiEdit tool use data schema (nested data part)
export const MultiEditToolUseDataSchema = z.object({
  filePath: z.string(),
  edits: z.array(
    z.object({
      oldString: z.string(),
      newString: z.string(),
      replaceAll: z.boolean().optional(),
    }),
  ),
});

// Task tool use data schema (nested data part)
export const TaskToolUseDataSchema = z.object({
  subagentType: z.string(),
  description: z.string(),
  prompt: z.string(),
});

// Grep tool use data schema (nested data part)
export const GrepToolUseDataSchema = z.object({
  pattern: z.string(),
  path: z.string(),
  outputMode: z.string(),
  lineNumbers: z.boolean().optional(),
  headLimit: z.number().optional(),
  contextLines: z.number().optional(),
});

// Glob tool use data schema (nested data part)
export const GlobToolUseDataSchema = z.object({
  pattern: z.string(),
  path: z.string().optional(),
});

// LS tool use data schema (nested data part)
export const LsToolUseDataSchema = z.object({
  path: z.string(),
});

// Tool use schema with the actual nested structure
export const AssistantMessageToolUseSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('todo'),
    toolId: z.string(),
    data: TodoToolUseDataSchema,
  }),
  z.object({
    type: z.literal('read'),
    toolId: z.string(),
    data: ReadToolUseDataSchema,
  }),
  z.object({
    type: z.literal('bash'),
    toolId: z.string(),
    data: BashToolUseDataSchema,
  }),
  z.object({
    type: z.literal('edit'),
    toolId: z.string(),
    data: EditToolUseDataSchema,
  }),
  z.object({
    type: z.literal('multiedit'),
    toolId: z.string(),
    data: MultiEditToolUseDataSchema,
  }),
  z.object({
    type: z.literal('task'),
    toolId: z.string(),
    data: TaskToolUseDataSchema,
  }),
  z.object({
    type: z.literal('grep'),
    toolId: z.string(),
    data: GrepToolUseDataSchema,
  }),
  z.object({
    type: z.literal('glob'),
    toolId: z.string(),
    data: GlobToolUseDataSchema,
  }),
  z.object({
    type: z.literal('ls'),
    toolId: z.string(),
    data: LsToolUseDataSchema,
  }),
]);

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
export type TodoToolUseData = z.infer<typeof TodoToolUseDataSchema>;
export type ReadToolUseData = z.infer<typeof ReadToolUseDataSchema>;
export type BashToolUseData = z.infer<typeof BashToolUseDataSchema>;
export type EditToolUseData = z.infer<typeof EditToolUseDataSchema>;
export type MultiEditToolUseData = z.infer<typeof MultiEditToolUseDataSchema>;
export type TaskToolUseData = z.infer<typeof TaskToolUseDataSchema>;
export type GrepToolUseData = z.infer<typeof GrepToolUseDataSchema>;
export type GlobToolUseData = z.infer<typeof GlobToolUseDataSchema>;
export type LsToolUseData = z.infer<typeof LsToolUseDataSchema>;
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
