import { z } from 'zod';

// Header emitted at the start of a Codex run (metadata line without `type`)
export const CodexHeaderSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  instructions: z.string(),
  git: z.object({
    commit_hash: z.string(),
    branch: z.string(),
    repository_url: z.string(),
  }),
});
export type CodexHeader = z.infer<typeof CodexHeaderSchema>;

// State heartbeat lines
export const CodexStateSchema = z.object({
  record_type: z.literal('state'),
});
export type CodexState = z.infer<typeof CodexStateSchema>;

// Reasoning (opaque, but we capture structure without assertions)
export const CodexReasoningSummaryItemSchema = z.object({
  type: z.literal('summary_text'),
  text: z.string(),
});
export type CodexReasoningSummaryItem = z.infer<typeof CodexReasoningSummaryItemSchema>;

export const CodexReasoningSchema = z.object({
  type: z.literal('reasoning'),
  id: z.string(),
  summary: z.array(CodexReasoningSummaryItemSchema),
  content: z.null(),
  encrypted_content: z.string(),
});
export type CodexReasoning = z.infer<typeof CodexReasoningSchema>;

// Message content blocks
export const CodexInputTextBlockSchema = z.object({
  type: z.literal('input_text'),
  text: z.string(),
});
export type CodexInputTextBlock = z.infer<typeof CodexInputTextBlockSchema>;

export const CodexOutputTextBlockSchema = z.object({
  type: z.literal('output_text'),
  text: z.string(),
});
export type CodexOutputTextBlock = z.infer<typeof CodexOutputTextBlockSchema>;

export const CodexMessageContentBlockSchema = z.union([
  CodexInputTextBlockSchema,
  CodexOutputTextBlockSchema,
]);
export type CodexMessageContentBlock = z.infer<typeof CodexMessageContentBlockSchema>;

// User/Assistant/System messages
export const CodexMessageSchema = z.object({
  type: z.literal('message'),
  id: z.string().nullable(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.array(CodexMessageContentBlockSchema).nonempty(),
});
export type CodexMessage = z.infer<typeof CodexMessageSchema>;

// Tool call (function_call) and result (function_call_output)
export const CodexFunctionCallSchema = z.object({
  type: z.literal('function_call'),
  id: z.string(),
  name: z.string(), // e.g., 'shell'
  arguments: z.string(), // JSON string (parse later with a dedicated schema)
  call_id: z.string(),
});
export type CodexFunctionCall = z.infer<typeof CodexFunctionCallSchema>;

export const CodexFunctionCallOutputSchema = z.object({
  type: z.literal('function_call_output'),
  call_id: z.string(),
  output: z.string(), // JSON string (provider-dependent)
});
export type CodexFunctionCallOutput = z.infer<typeof CodexFunctionCallOutputSchema>;

// Optional helper schemas for known function names (kept separate from the main union)
// Example: validated structure for a `shell` call's parsed arguments
export const CodexShellCallArgumentsSchema = z.object({
  command: z.array(z.string()),
  timeout_ms: z.number().int().positive().optional(),
  workdir: z.string().optional(),
});
export type CodexShellCallArguments = z.infer<typeof CodexShellCallArgumentsSchema>;

// Additional Codex event shapes observed in the wild (COI stream)
export const CodexAgentMessageSchema = z.object({
  type: z.literal('agent_message'),
  message: z.string(),
});
export type CodexAgentMessage = z.infer<typeof CodexAgentMessageSchema>;

export const CodexTokenCountSchema = z.object({
  type: z.literal('token_count'),
  input_tokens: z.number().int().nonnegative(),
  cached_input_tokens: z.number().int().nonnegative().optional().default(0),
  output_tokens: z.number().int().nonnegative().optional().default(0),
  reasoning_output_tokens: z.number().int().nonnegative().optional().default(0),
  total_tokens: z.number().int().nonnegative(),
});
export type CodexTokenCount = z.infer<typeof CodexTokenCountSchema>;

export const CodexTaskStartedSchema = z.object({
  type: z.literal('task_started'),
  model_context_window: z.number().int().positive(),
});
export type CodexTaskStarted = z.infer<typeof CodexTaskStartedSchema>;

export const CodexAgentReasoningSectionBreakSchema = z.object({
  type: z.literal('agent_reasoning_section_break'),
});
export type CodexAgentReasoningSectionBreak = z.infer<typeof CodexAgentReasoningSectionBreakSchema>;

export const CodexAgentReasoningSchema = z.object({
  type: z.literal('agent_reasoning'),
  text: z.string(),
});
export type CodexAgentReasoning = z.infer<typeof CodexAgentReasoningSchema>;

// Exec command lifecycle
export const CodexExecCommandBeginSchema = z.object({
  type: z.literal('exec_command_begin'),
  call_id: z.string(),
  command: z.array(z.string()),
  cwd: z.string(),
  parsed_cmd: z
    .array(
      z.object({
        type: z.string(),
        cmd: z.string(),
        path: z.string().nullable().optional(),
      }),
    )
    .optional(),
});
export type CodexExecCommandBegin = z.infer<typeof CodexExecCommandBeginSchema>;

export const CodexExecCommandOutputDeltaSchema = z.object({
  type: z.literal('exec_command_output_delta'),
  call_id: z.string(),
  stream: z.enum(['stdout', 'stderr']),
  chunk: z.array(z.number().int().min(0).max(255)),
});
export type CodexExecCommandOutputDelta = z.infer<typeof CodexExecCommandOutputDeltaSchema>;

export const CodexExecCommandEndSchema = z.object({
  type: z.literal('exec_command_end'),
  call_id: z.string(),
  stdout: z.string(),
  stderr: z.string(),
  aggregated_output: z.string().optional(),
  formatted_output: z.string().optional(),
  exit_code: z.number().int(),
  duration: z.object({
    secs: z.number().int().nonnegative(),
    nanos: z.number().int().nonnegative(),
  }),
});
export type CodexExecCommandEnd = z.infer<typeof CodexExecCommandEndSchema>;

// Patches and diffs
export const CodexTurnDiffSchema = z.object({
  type: z.literal('turn_diff'),
  unified_diff: z.string(),
});
export type CodexTurnDiff = z.infer<typeof CodexTurnDiffSchema>;

const FileChangeUpdateSchema = z.object({
  unified_diff: z.string(),
  move_path: z.string().nullable().optional(),
});
export const CodexPatchApplyBeginSchema = z.object({
  type: z.literal('patch_apply_begin'),
  call_id: z.string(),
  auto_approved: z.boolean(),
  changes: z.record(
    z.string(),
    z.object({
      update: FileChangeUpdateSchema.optional(),
      add: z.object({ content: z.string() }).optional(),
      delete: z.object({}).optional(),
    }),
  ),
});
export type CodexPatchApplyBegin = z.infer<typeof CodexPatchApplyBeginSchema>;

export const CodexPatchApplyEndSchema = z.object({
  type: z.literal('patch_apply_end'),
  call_id: z.string(),
  stdout: z.string(),
  stderr: z.string(),
  success: z.boolean(),
});
export type CodexPatchApplyEnd = z.infer<typeof CodexPatchApplyEndSchema>;

// Base event union (no outer wrapper)
export const CodexEventSchema = z.union([
  CodexHeaderSchema, // legacy header line (no `type` field)
  CodexStateSchema,
  CodexReasoningSchema, // legacy
  CodexMessageSchema, // legacy
  CodexFunctionCallSchema, // legacy
  CodexFunctionCallOutputSchema, // legacy
  // COI stream events
  CodexTaskStartedSchema,
  CodexAgentReasoningSectionBreakSchema,
  CodexAgentReasoningSchema,
  CodexAgentMessageSchema,
  CodexExecCommandBeginSchema,
  CodexExecCommandOutputDeltaSchema,
  CodexExecCommandEndSchema,
  CodexTurnDiffSchema,
  CodexPatchApplyBeginSchema,
  CodexPatchApplyEndSchema,
  CodexTokenCountSchema,
]);
export type CodexEvent = z.infer<typeof CodexEventSchema>;

// Optional outer wrapper used by some emitters: { id, msg }
export const CodexWrappedMessageSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  msg: CodexEventSchema,
});
export type CodexWrappedMessage = z.infer<typeof CodexWrappedMessageSchema>;

// Canonical union of all known Codex JSONL line shapes (raw or wrapped)
export const CodexSDKMessageSchema = z.union([CodexEventSchema, CodexWrappedMessageSchema]);
export type CodexSDKMessage = z.infer<typeof CodexSDKMessageSchema>;

// Narrow helpers
export const isCodexSDKMessage = (v: unknown): v is CodexSDKMessage =>
  CodexSDKMessageSchema.safeParse(v).success;
export const isCodexFunctionCall = (v: unknown): v is CodexFunctionCall =>
  CodexFunctionCallSchema.safeParse(v).success;
export const isCodexFunctionCallOutput = (v: unknown): v is CodexFunctionCallOutput =>
  CodexFunctionCallOutputSchema.safeParse(v).success;
export const isCodexReasoning = (v: unknown): v is CodexReasoning =>
  CodexReasoningSchema.safeParse(v).success;
export const isCodexState = (v: unknown): v is CodexState => CodexStateSchema.safeParse(v).success;
export const isCodexHeader = (v: unknown): v is CodexHeader =>
  CodexHeaderSchema.safeParse(v).success;

export const isCodexWrapped = (v: unknown): v is CodexWrappedMessage =>
  CodexWrappedMessageSchema.safeParse(v).success;

// Unwrap helper to always return the inner event
export function unwrapCodexSDKMessage(msg: CodexSDKMessage): CodexEvent {
  const wrapped = CodexWrappedMessageSchema.safeParse(msg);
  if (wrapped.success) return wrapped.data.msg;
  return CodexEventSchema.parse(msg);
}

// Non-wrapped run metadata lines
export const CodexRunConfigSchema = z
  .object({
    approval: z.string().optional(),
    'reasoning summaries': z.string().optional(),
    'reasoning effort': z.string().optional(),
    workdir: z.string().optional(),
    provider: z.string().optional(),
    model: z.string().optional(),
    sandbox: z.string().optional(),
  })
  .passthrough();
export type CodexRunConfig = z.infer<typeof CodexRunConfigSchema>;

export const CodexPromptLineSchema = z.object({ prompt: z.string() });
export type CodexPromptLine = z.infer<typeof CodexPromptLineSchema>;

// COI top-level schema that also accepts run config and prompt lines
export const CodexSDKOrEnvelopeSchema = z.union([
  CodexSDKMessageSchema,
  CodexRunConfigSchema,
  CodexPromptLineSchema,
]);
