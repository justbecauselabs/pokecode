import { existsSync, readFileSync } from 'node:fs';
import type { ApiChildMessage } from '@/schemas/message.schema';
import {
  type AssistantJsonlMessage,
  type JsonlMessage,
  JsonlMessageSchema,
  type MessageContent,
  type UserJsonlMessage,
} from '@/types/claude-messages';
import { logger } from './logger';

/**
 * Parse a JSONL file and validate with Zod
 */
export function parseJsonlFile(filePath: string): JsonlMessage[] {
  if (!existsSync(filePath)) {
    logger.debug({ filePath }, 'JSONL file does not exist');
    return [];
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());
  const messages: JsonlMessage[] = [];

  for (const [index, line] of lines.entries()) {
    try {
      const parsed = JSON.parse(line);
      const validated = JsonlMessageSchema.parse(parsed);
      messages.push(validated);
    } catch (error) {
      logger.warn(
        {
          filePath,
          lineNumber: index + 1,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to parse JSONL line',
      );
      // Skip invalid lines
    }
  }

  logger.debug(
    {
      filePath,
      totalLines: lines.length,
      validMessages: messages.length,
    },
    'Parsed JSONL file',
  );

  return messages;
}

/**
 * Convert validated JSONL messages to API child messages
 */
export function jsonlToApiChildren(jsonl: JsonlMessage[]): ApiChildMessage[] {
  return jsonl
    .filter((msg) => msg.type === 'user' || msg.type === 'assistant')
    .map((msg) => {
      const base = {
        id: msg.uuid,
        role: msg.type as 'user' | 'assistant',
        content: extractContent(msg as UserJsonlMessage | AssistantJsonlMessage),
        timestamp: msg.timestamp,
      };

      const toolCalls = extractToolCalls(msg as AssistantJsonlMessage);
      const toolResults = extractToolResults(msg as UserJsonlMessage);
      const thinking = extractThinking(msg as AssistantJsonlMessage);

      return {
        ...base,
        ...(toolCalls && { toolCalls }),
        ...(toolResults && { toolResults }),
        ...(thinking && { thinking }),
      };
    });
}

/**
 * Extract text content from a message
 */
function extractContent(msg: UserJsonlMessage | AssistantJsonlMessage): string {
  if (msg.type === 'user') {
    const content = msg.message.content;
    if (typeof content === 'string') {
      return content;
    }
    // Content is array of MessageContent
    return content
      .filter((c: MessageContent) => c.type === 'text')
      .map((c: MessageContent) => (c.type === 'text' ? c.text : ''))
      .join('');
  }

  if (msg.type === 'assistant') {
    return msg.message.content
      .filter((c) => c.type === 'text')
      .map((c) => (c.type === 'text' ? c.text : ''))
      .join('');
  }

  return '';
}

/**
 * Extract tool calls from assistant messages
 */
function extractToolCalls(
  msg: AssistantJsonlMessage,
): Array<{ name: string; input: Record<string, unknown> }> | undefined {
  if (msg.type !== 'assistant') return undefined;

  const toolCalls = msg.message.content
    .filter((c) => c.type === 'tool_use')
    .map((c) => {
      if (c.type === 'tool_use') {
        return {
          name: c.name,
          input: c.input as Record<string, unknown>,
        };
      }
      return null;
    })
    .filter((t): t is { name: string; input: Record<string, unknown> } => t !== null);

  return toolCalls.length > 0 ? toolCalls : undefined;
}

/**
 * Extract thinking content from assistant messages
 */
function extractThinking(msg: AssistantJsonlMessage): string | undefined {
  if (msg.type !== 'assistant') return undefined;

  const thinking = msg.message.content
    .filter((c) => c.type === 'thinking')
    .map((c) => (c.type === 'thinking' ? c.thinking : ''))
    .join('');

  return thinking || undefined;
}

/**
 * Extract tool results from user messages
 */
function extractToolResults(
  msg: UserJsonlMessage,
): Array<{ tool_use_id: string; content: string }> | undefined {
  if (msg.type !== 'user') return undefined;

  const content = msg.message.content;
  
  // If content is a string, no tool results
  if (typeof content === 'string') {
    return undefined;
  }

  // Content is array of MessageContent, look for tool_result
  const toolResults = content
    .filter((c: MessageContent) => c.type === 'tool_result')
    .map((c: MessageContent) => {
      if (c.type === 'tool_result') {
        return {
          tool_use_id: c.tool_use_id,
          content: c.content,
        };
      }
      return null;
    })
    .filter((t): t is { tool_use_id: string; content: string } => t !== null);

  return toolResults.length > 0 ? toolResults : undefined;
}

/**
 * Extract final text content from Claude SDK response for saving to DB
 */
export function extractFinalContent(response: unknown): string {
  // This will depend on the actual Claude SDK response structure
  // For now, a simple implementation
  if (typeof response === 'object' && response && 'content' in response) {
    if (typeof response.content === 'string') {
      return response.content;
    }
    if (Array.isArray(response.content)) {
      return response.content
        .filter((c: unknown) => {
          return typeof c === 'object' && c !== null && 'type' in c && c.type === 'text';
        })
        .map((c: unknown) => {
          if (typeof c === 'object' && c !== null && 'text' in c) {
            return typeof c.text === 'string' ? c.text : '';
          }
          return '';
        })
        .join('');
    }
  }
  return '';
}

/**
 * Extract Claude session ID from SDK response
 */
export function extractClaudeSessionId(response: unknown): string | undefined {
  if (typeof response === 'object' && response && 'sessionId' in response) {
    return response.sessionId as string;
  }
  return undefined;
}
