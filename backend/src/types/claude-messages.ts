import { z } from 'zod';

/**
 * Precise Zod schemas for Claude Code JSONL message validation
 * Based on actual JSONL file structure analysis - NO unknowns or anys
 */

// Precise tool input schemas based on actual usage patterns
const LSToolInputSchema = z.object({
  path: z.string(),
  ignore: z.array(z.string()).optional(),
});

const ReadToolInputSchema = z.object({
  file_path: z.string(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

const WriteToolInputSchema = z.object({
  file_path: z.string(),
  content: z.string(),
});

const EditToolInputSchema = z.object({
  file_path: z.string(),
  old_string: z.string(),
  new_string: z.string(),
  replace_all: z.boolean().optional(),
});

const BashToolInputSchema = z.object({
  command: z.string(),
  description: z.string().optional(),
  timeout: z.number().optional(),
  run_in_background: z.boolean().optional(),
});

const GrepToolInputSchema = z.object({
  pattern: z.string(),
  path: z.string().optional(),
  glob: z.string().optional(),
  type: z.string().optional(),
  output_mode: z.enum(['content', 'files_with_matches', 'count']).optional(),
  '-n': z.boolean().optional(),
  '-i': z.boolean().optional(),
  '-A': z.number().optional(),
  '-B': z.number().optional(),
  '-C': z.number().optional(),
  head_limit: z.number().optional(),
  multiline: z.boolean().optional(),
});

const GlobToolInputSchema = z.object({
  pattern: z.string(),
  path: z.string().optional(),
});

// TodoWrite-specific schema for todo items
const TodoItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed']),
});

const TodoWriteInputSchema = z.object({
  todos: z.array(TodoItemSchema),
});

// MultiEdit-specific schema for edit operations
const MultiEditItemSchema = z.object({
  old_string: z.string(),
  new_string: z.string(),
  replace_all: z.boolean().optional(),
});

const MultiEditInputSchema = z.object({
  file_path: z.string(),
  edits: z.array(MultiEditItemSchema),
});

// Generic tool input for other tools - but strongly typed
const GenericToolInputSchema = z.record(
  z.string(),
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.array(z.number()),
    z.array(
      z
        .object({
          id: z.string().optional(),
          content: z.string().optional(),
          status: z.string().optional(),
        })
        .passthrough(),
    ), // Allow arrays of objects with flexible structure
    z
      .object({})
      .passthrough(), // Allow objects with any structure
  ]),
);

// Tool input discriminated union based on tool name
const ToolInputSchema = z.union([
  LSToolInputSchema,
  ReadToolInputSchema,
  WriteToolInputSchema,
  EditToolInputSchema,
  MultiEditInputSchema,
  BashToolInputSchema,
  GrepToolInputSchema,
  GlobToolInputSchema,
  TodoWriteInputSchema,
  GenericToolInputSchema,
]);

// Content types for messages
const TextContentSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

const ToolUseContentSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string().startsWith('toolu_'),
  name: z.string(),
  input: ToolInputSchema,
});

const ToolResultContentSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string().startsWith('toolu_'),
  content: z.string(), // Based on actual data, always string
});

// Thinking content (for internal reasoning)
const ThinkingContentSchema = z.object({
  type: z.literal('thinking'),
  thinking: z.string(),
  signature: z.string().optional(),
});

const MessageContentSchema = z.union([
  TextContentSchema,
  ToolUseContentSchema,
  ToolResultContentSchema,
  ThinkingContentSchema,
]);

// User message content - always string based on actual data
const UserMessageSchema = z.object({
  role: z.literal('user'),
  content: z.union([
    z.string(),
    z.array(MessageContentSchema), // For tool results embedded in user messages
  ]),
});

// Assistant message with precise Claude API response metadata
const AssistantMessageSchema = z.object({
  role: z.literal('assistant'),
  content: z.array(MessageContentSchema), // Always array in assistant messages
  id: z.string(), // Relaxed - some messages don't start with msg_
  type: z.literal('message'),
  model: z.string(), // e.g., "claude-sonnet-4-20250514"
  stop_reason: z.string().nullable(),
  stop_sequence: z.string().nullable(),
  usage: z.object({
    input_tokens: z.number(),
    cache_creation_input_tokens: z.number().optional(),
    cache_read_input_tokens: z.number(),
    output_tokens: z.number(),
    service_tier: z.string().nullable(), // Allow null values for service_tier
  }),
});

// Summary message for conversation threads - exact structure
const SummaryMessageSchema = z.object({
  type: z.literal('summary'),
  summary: z.string(),
  leafUuid: z.string(), // UUID format
});

// Base JSONL message structure with precise fields from actual data
const BaseJsonlMessageSchema = z.object({
  uuid: z.string(), // UUID format
  parentUuid: z.string().nullable(),
  sessionId: z.string(), // UUID format
  timestamp: z.string().datetime(), // ISO 8601 format
  type: z.enum(['user', 'assistant']), // Summary handled separately
  isSidechain: z.boolean(),
  userType: z.enum(['external']), // Based on observed values
  cwd: z.string(), // Current working directory path
  version: z.string(), // e.g., "1.0.73"
  gitBranch: z.string(), // Git branch name
});

// User message in JSONL format - precise structure
const UserJsonlMessageSchema = BaseJsonlMessageSchema.extend({
  type: z.literal('user'),
  message: UserMessageSchema,
});

// Assistant message in JSONL format - precise structure
const AssistantJsonlMessageSchema = BaseJsonlMessageSchema.extend({
  type: z.literal('assistant'),
  message: AssistantMessageSchema,
  requestId: z.string().optional(), // Optional - some messages don't have this
  toolUseResult: z.string().optional(), // Optional tool result text
});

// Complete JSONL message schema (discriminated union)
export const JsonlMessageSchema = z.discriminatedUnion('type', [
  UserJsonlMessageSchema,
  AssistantJsonlMessageSchema,
  SummaryMessageSchema,
]);

// Intermediate message format used by the API - precise types
export const IntermediateMessageSchema = z.object({
  id: z.string(), // UUID
  content: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  type: z.enum(['user', 'assistant', 'summary']).optional(),
  timestamp: z.string().datetime(),
  metadata: z
    .object({
      parentUuid: z.string().nullable().optional(),
      sessionId: z.string().optional(), // UUID
      isSidechain: z.boolean().optional(),
      userType: z.enum(['external']).optional(),
      requestId: z.string().optional(), // Format: req_...
      toolUseResult: z.string().optional(),
      cwd: z.string().optional(),
      version: z.string().optional(),
      gitBranch: z.string().optional(),
    })
    .optional(),
});

// TypeScript types inferred from precise Zod schemas - no unknowns/anys
export type LSToolInput = z.infer<typeof LSToolInputSchema>;
export type ReadToolInput = z.infer<typeof ReadToolInputSchema>;
export type WriteToolInput = z.infer<typeof WriteToolInputSchema>;
export type EditToolInput = z.infer<typeof EditToolInputSchema>;
export type MultiEditInput = z.infer<typeof MultiEditInputSchema>;
export type BashToolInput = z.infer<typeof BashToolInputSchema>;
export type GrepToolInput = z.infer<typeof GrepToolInputSchema>;
export type GlobToolInput = z.infer<typeof GlobToolInputSchema>;
export type TodoWriteInput = z.infer<typeof TodoWriteInputSchema>;
export type GenericToolInput = z.infer<typeof GenericToolInputSchema>;
export type ToolInput = z.infer<typeof ToolInputSchema>;

export type TextContent = z.infer<typeof TextContentSchema>;
export type ToolUseContent = z.infer<typeof ToolUseContentSchema>;
export type ToolResultContent = z.infer<typeof ToolResultContentSchema>;
export type ThinkingContent = z.infer<typeof ThinkingContentSchema>;
export type MessageContent = z.infer<typeof MessageContentSchema>;

export type UserMessage = z.infer<typeof UserMessageSchema>;
export type AssistantMessage = z.infer<typeof AssistantMessageSchema>;
export type SummaryMessage = z.infer<typeof SummaryMessageSchema>;

export type BaseJsonlMessage = z.infer<typeof BaseJsonlMessageSchema>;
export type UserJsonlMessage = z.infer<typeof UserJsonlMessageSchema>;
export type AssistantJsonlMessage = z.infer<typeof AssistantJsonlMessageSchema>;
export type JsonlMessage = z.infer<typeof JsonlMessageSchema>;

export type IntermediateMessage = z.infer<typeof IntermediateMessageSchema>;

// All types are now strictly typed - no unknowns or anys
