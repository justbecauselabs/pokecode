import type { Message } from '@pokecode/types';
import {
  CodexFunctionCallOutputSchema,
  CodexFunctionCallSchema,
  CodexHeaderSchema,
  CodexMessageSchema,
  CodexSDKMessageSchema,
  CodexShellCallArgumentsSchema,
  CodexStateSchema,
} from '@pokecode/types';
import { z } from 'zod';
import type { SessionMessage } from '../database/schema-sqlite/session_messages';
import { logger } from './logger';

// Update plan call arguments (observed in codex-messages.jsonl)
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

// Generic shape we have seen embedded inside function_call_output.output JSON strings
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

function _relativizePath(params: { filePath: string; projectPath?: string }): string {
  const { filePath, projectPath } = params;
  if (!projectPath) return filePath;
  if (filePath.startsWith(projectPath)) {
    const relative = filePath.slice(projectPath.length);
    return relative.startsWith('/') ? relative.slice(1) : relative;
  }
  return filePath;
}

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

  // shell -> bash
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

  // update_plan -> task (encode explanation and plan as prompt)
  if (call.name === 'update_plan') {
    let prompt = call.arguments;
    try {
      const parsed = UpdatePlanArgumentsSchema.parse(JSON.parse(call.arguments));
      const lines: Array<string> = [];
      if (parsed.explanation) lines.push(parsed.explanation);
      if (parsed.plan) {
        for (const item of parsed.plan) {
          lines.push(`- [${item.status}] ${item.step}`);
        }
      }
      if (lines.length > 0) prompt = lines.join('\n');
    } catch (_error) {
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
          data: {
            subagentType: 'update_plan',
            description: 'Update plan',
            prompt,
          },
        },
      },
      parentToolUseId: null,
    };
  }

  // Fallback: unknown tool -> task
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
      if (typeof exit === 'number' && exit > 0) {
        isError = true;
      }
      if (o.error && o.error.trim().length > 0) {
        isError = true;
      }
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

/**
 * Parse a provider-specific DB message containing Codex JSONL content into a normalized Message.
 * Returns null for non-display records (headers, heartbeats, reasoning summaries).
 */
export function parseCodexDbMessage(
  dbMessage: SessionMessage,
  _projectPath?: string,
): Message | null {
  if (!dbMessage.contentData) return null;

  try {
    // Validate against the top-level union
    const line = CodexSDKMessageSchema.safeParse(JSON.parse(dbMessage.contentData));
    if (!line.success) {
      logger.warn({ issues: line.error.issues }, 'Unrecognized Codex JSONL line');
      return null;
    }

    const v = line.data;

    // Ignore non-message records
    if (CodexHeaderSchema.safeParse(v).success) return null;
    if (CodexStateSchema.safeParse(v).success) return null;
    // Reasoning records are not normalized; persist raw separately
    // Use duck-typing via discriminant instead of importing the schema again
    if (
      typeof (v as { type?: string }).type === 'string' &&
      (v as { type: string }).type === 'reasoning'
    ) {
      return null;
    }

    // Messages
    if (CodexMessageSchema.safeParse(v).success) {
      const m = CodexMessageSchema.parse(v);
      if (m.role === 'user') {
        const text = joinBlocksText({ blocks: m.content, kind: 'input_text' });
        if (text === null) return null;
        return {
          id: dbMessage.id,
          type: 'user',
          data: { content: text },
          parentToolUseId: null,
        };
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

      // system
      const text =
        joinBlocksText({ blocks: m.content, kind: 'input_text' }) ??
        joinBlocksText({ blocks: m.content, kind: 'output_text' });
      if (text === null) return null;
      return {
        id: dbMessage.id,
        type: 'system',
        data: { content: text },
        parentToolUseId: null,
      };
    }

    // Tool calls
    if (CodexFunctionCallSchema.safeParse(v).success) {
      const call = CodexFunctionCallSchema.parse(v);
      const msg = mapFunctionCallToToolUse({ call });
      if (msg === null) return null;
      return { ...msg, id: dbMessage.id };
    }

    // Tool results
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
