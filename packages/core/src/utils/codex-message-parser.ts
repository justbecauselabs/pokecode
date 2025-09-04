import type { Message } from '@pokecode/types';
import {
  CodexAgentMessageSchema,
  CodexAgentReasoningSchema,
  CodexAgentReasoningSectionBreakSchema,
  CodexExecCommandBeginSchema,
  CodexExecCommandEndSchema,
  CodexExecCommandOutputDeltaSchema,
  CodexFunctionCallOutputSchema,
  CodexFunctionCallSchema,
  CodexHeaderSchema,
  CodexMessageSchema,
  CodexPatchApplyBeginSchema,
  CodexPatchApplyEndSchema,
  CodexSDKMessageSchema,
  CodexShellCallArgumentsSchema,
  CodexStateSchema,
  CodexTaskStartedSchema,
  CodexTokenCountSchema,
  CodexTurnDiffSchema,
  unwrapCodexSDKMessage,
} from '@pokecode/types';
import { z } from 'zod';
import type { SessionMessage } from '../database/schema-sqlite/session_messages';
import { logger } from './logger';

// Update plan call arguments (legacy function_call helper)
const UpdatePlanArgumentsSchema = z.object({
  explanation: z.string().optional(),
  plan: z
    .array(
      z.object({
        status: z.enum(['pending', 'in_progress', 'completed']),
        step: z.string(),
      }),
    )
    .optional(),
});

// Generic shape embedded inside legacy function_call_output.output JSON strings
const FunctionCallOutputPayloadSchema = z.object({
  output: z.string().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  error: z.string().optional(),
  exit_code: z.number().int().optional(),
  metadata: z
    .object({
      stdout: z.string().optional(),
      stderr: z.string().optional(),
      error: z.string().optional(),
      exit_code: z.number().int().optional(),
    })
    .optional(),
});

function joinBlocksText(params: {
  blocks: ReadonlyArray<{ type: 'input_text' | 'output_text'; text: string }>;
  kind: 'input_text' | 'output_text';
}): string | null {
  const { blocks, kind } = params;
  const parts: Array<string> = [];
  for (const b of blocks) {
    if (b.type === kind) parts.push(b.text);
  }
  return parts.length > 0 ? parts.join('\n\n') : null;
}

function mapFunctionCallToToolUse(params: {
  call: z.infer<typeof CodexFunctionCallSchema>;
}): Message | null {
  const { call } = params;

  if (call.name === 'shell') {
    try {
      const args = CodexShellCallArgumentsSchema.parse(JSON.parse(call.arguments));
      const command = args.command.join(' ');
      return {
        id: '',
        type: 'assistant',
        data: {
          type: 'tool_use',
          data: {
            type: 'bash',
            toolId: call.call_id,
            data: {
              command,
              ...(args.timeout_ms !== undefined ? { timeout: args.timeout_ms } : {}),
            },
          },
        },
        parentToolUseId: null,
      };
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to parse shell call args',
      );
      return {
        id: '',
        type: 'assistant',
        data: {
          type: 'tool_use',
          data: {
            type: 'task',
            toolId: call.call_id,
            data: {
              subagentType: 'codex-shell',
              description: 'Run shell command',
              prompt: call.arguments,
            },
          },
        },
        parentToolUseId: null,
      };
    }
  }

  if (call.name === 'update_plan') {
    let prompt = call.arguments;
    try {
      const parsed = UpdatePlanArgumentsSchema.parse(JSON.parse(call.arguments));
      const lines: Array<string> = [];
      if (parsed.explanation) lines.push(parsed.explanation);
      if (parsed.plan)
        for (const item of parsed.plan) lines.push(`- [${item.status}] ${item.step}`);
      if (lines.length > 0) prompt = lines.join('\n');
    } catch {
      // keep raw prompt
    }
    return {
      id: '',
      type: 'assistant',
      data: {
        type: 'tool_use',
        data: {
          type: 'task',
          toolId: call.call_id,
          data: { subagentType: 'update_plan', description: 'Update plan', prompt },
        },
      },
      parentToolUseId: null,
    };
  }

  return {
    id: '',
    type: 'assistant',
    data: {
      type: 'tool_use',
      data: {
        type: 'task',
        toolId: call.call_id,
        data: {
          subagentType: 'codex-unknown-tool',
          description: `Tool call: ${call.name}`,
          prompt: call.arguments,
        },
      },
    },
    parentToolUseId: null,
  };
}

function mapFunctionCallOutputToToolResult(params: {
  output: z.infer<typeof CodexFunctionCallOutputSchema>;
}): Message {
  const { output } = params;
  let content = output.output;
  let isError: boolean | undefined;
  try {
    const parsed = JSON.parse(output.output);
    const result = FunctionCallOutputPayloadSchema.safeParse(parsed);
    if (result.success) {
      const o = result.data;
      const pick =
        o.output ??
        o.stdout ??
        o.stderr ??
        o.metadata?.stdout ??
        o.metadata?.stderr ??
        o.metadata?.error ??
        '';
      if (pick.length > 0) content = pick;
      const exit = o.exit_code ?? o.metadata?.exit_code;
      if (typeof exit === 'number' && exit > 0) isError = true;
      if (o.error && o.error.trim().length > 0) isError = true;
    }
  } catch {
    // keep raw string
  }
  return {
    id: '',
    type: 'assistant',
    data: {
      type: 'tool_result',
      data: { toolUseId: output.call_id, content, ...(isError ? { isError } : {}) },
    },
    parentToolUseId: output.call_id,
  };
}

function mapExecCommandBeginToToolUse(params: {
  e: z.infer<typeof CodexExecCommandBeginSchema>;
}): Message {
  const { e } = params;
  const c = e.command;
  const cmd =
    c.length >= 3 && c[0] === 'bash' && c[1] === '-lc' ? (c[2] ?? c.join(' ')) : c.join(' ');
  return {
    id: '',
    type: 'assistant',
    data: { type: 'tool_use', data: { type: 'bash', toolId: e.call_id, data: { command: cmd } } },
    parentToolUseId: null,
  };
}

function mapExecCommandEndToToolResult(params: {
  e: z.infer<typeof CodexExecCommandEndSchema>;
}): Message {
  const { e } = params;
  const content =
    (e.formatted_output && e.formatted_output.length > 0 && e.formatted_output) ||
    (e.aggregated_output && e.aggregated_output.length > 0 && e.aggregated_output) ||
    (e.stdout && e.stdout.length > 0 && e.stdout) ||
    (e.stderr && e.stderr.length > 0 && e.stderr) ||
    '';
  const isError = e.exit_code !== 0 || (e.stderr && e.stderr.trim().length > 0);
  return {
    id: '',
    type: 'assistant',
    data: {
      type: 'tool_result',
      data: { toolUseId: e.call_id, content, ...(isError ? { isError } : {}) },
    },
    parentToolUseId: e.call_id,
  };
}

function relativizePath(filePath: string, projectPath?: string): string {
  if (!projectPath) return filePath;
  return filePath.startsWith(projectPath)
    ? filePath.slice(projectPath.length).replace(/^\/+/, '')
    : filePath;
}

function mapPatchApplyBeginToToolUse(params: {
  e: z.infer<typeof CodexPatchApplyBeginSchema>;
  projectPath?: string;
}): Message {
  const { e, projectPath } = params;
  const files = Object.keys(e.changes);
  const first = files[0] ?? '';
  const filePath = relativizePath(first, projectPath);
  return {
    id: '',
    type: 'assistant',
    data: {
      type: 'tool_use',
      data: {
        type: 'edit',
        toolId: e.call_id,
        data: { filePath, oldString: '', newString: '' },
      },
    },
    parentToolUseId: null,
  };
}

function mapPatchApplyEndToToolResult(params: {
  e: z.infer<typeof CodexPatchApplyEndSchema>;
}): Message {
  const { e } = params;
  const content = e.stdout && e.stdout.length > 0 ? e.stdout : e.stderr;
  const isError = !e.success || (e.stderr && e.stderr.trim().length > 0);
  return {
    id: '',
    type: 'assistant',
    data: {
      type: 'tool_result',
      data: { toolUseId: e.call_id, content, ...(isError ? { isError } : {}) },
    },
    parentToolUseId: e.call_id,
  };
}

export function parseCodexDbMessage(
  dbMessage: SessionMessage,
  _projectPath?: string,
): Message | null {
  if (!dbMessage.contentData) return null;
  try {
    const parsedLine = CodexSDKMessageSchema.safeParse(JSON.parse(dbMessage.contentData));
    if (!parsedLine.success) {
      logger.warn({ issues: parsedLine.error.issues }, 'Unrecognized Codex JSONL line');
      return null;
    }

    const v = unwrapCodexSDKMessage(parsedLine.data);

    // Ignore non-display records
    if (CodexHeaderSchema.safeParse(v).success) return null;
    if (CodexStateSchema.safeParse(v).success) return null;
    if (CodexTaskStartedSchema.safeParse(v).success) return null;
    if (CodexAgentReasoningSectionBreakSchema.safeParse(v).success) return null;
    if (CodexTokenCountSchema.safeParse(v).success) return null;
    if (CodexExecCommandOutputDeltaSchema.safeParse(v).success) return null;

    // Legacy messages
    if (CodexMessageSchema.safeParse(v).success) {
      const m = CodexMessageSchema.parse(v);
      if (m.role === 'user') {
        const text = joinBlocksText({ blocks: m.content, kind: 'input_text' });
        if (text === null) return null;
        return { id: dbMessage.id, type: 'user', data: { content: text }, parentToolUseId: null };
      }
      if (m.role === 'assistant') {
        const text = joinBlocksText({ blocks: m.content, kind: 'output_text' });
        if (text === null) return null;
        return {
          id: dbMessage.id,
          type: 'assistant',
          data: { type: 'message', data: { content: text } },
          parentToolUseId: null,
        };
      }
      const text =
        joinBlocksText({ blocks: m.content, kind: 'input_text' }) ??
        joinBlocksText({ blocks: m.content, kind: 'output_text' });
      if (text === null) return null;
      return { id: dbMessage.id, type: 'system', data: { content: text }, parentToolUseId: null };
    }

    // COI agent message
    if (CodexAgentMessageSchema.safeParse(v).success) {
      const e = CodexAgentMessageSchema.parse(v);
      return {
        id: dbMessage.id,
        type: 'assistant',
        data: { type: 'message', data: { content: e.message } },
        parentToolUseId: null,
      };
    }

    // COI agent reasoning — map to assistant message
    if (CodexAgentReasoningSchema.safeParse(v).success) {
      const e = CodexAgentReasoningSchema.parse(v);
      return {
        id: dbMessage.id,
        type: 'assistant',
        data: { type: 'message', data: { content: e.text } },
        parentToolUseId: null,
      };
    }

    // COI diffs
    if (CodexTurnDiffSchema.safeParse(v).success) {
      const e = CodexTurnDiffSchema.parse(v);
      return {
        id: dbMessage.id,
        type: 'assistant',
        data: { type: 'message', data: { content: e.unified_diff } },
        parentToolUseId: null,
      };
    }

    // COI exec commands
    if (CodexExecCommandBeginSchema.safeParse(v).success) {
      const e = CodexExecCommandBeginSchema.parse(v);
      const msg = mapExecCommandBeginToToolUse({ e });
      return { ...msg, id: dbMessage.id };
    }
    if (CodexExecCommandEndSchema.safeParse(v).success) {
      const e = CodexExecCommandEndSchema.parse(v);
      const msg = mapExecCommandEndToToolResult({ e });
      return { ...msg, id: dbMessage.id };
    }

    // COI patch apply
    if (CodexPatchApplyBeginSchema.safeParse(v).success) {
      const e = CodexPatchApplyBeginSchema.parse(v);
      const msg = mapPatchApplyBeginToToolUse(
        _projectPath !== undefined ? { e, projectPath: _projectPath } : { e },
      );
      return { ...msg, id: dbMessage.id };
    }
    if (CodexPatchApplyEndSchema.safeParse(v).success) {
      const e = CodexPatchApplyEndSchema.parse(v);
      const msg = mapPatchApplyEndToToolResult({ e });
      return { ...msg, id: dbMessage.id };
    }

    // Legacy tools
    if (CodexFunctionCallSchema.safeParse(v).success) {
      const call = CodexFunctionCallSchema.parse(v);
      const msg = mapFunctionCallToToolUse({ call });
      if (msg === null) return null;
      return { ...msg, id: dbMessage.id };
    }
    if (CodexFunctionCallOutputSchema.safeParse(v).success) {
      const out = CodexFunctionCallOutputSchema.parse(v);
      const msg = mapFunctionCallOutputToToolResult({ output: out });
      return { ...msg, id: dbMessage.id };
    }

    return null;
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error), messageId: dbMessage.id },
      'Failed to parse Codex DB message',
    );
    return null;
  }
}
