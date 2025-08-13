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
 * Convert validated JSONL messages to API child messages
 */
export function jsonlToApiChildren(jsonl: JsonlMessage[]): ApiChildMessage[] {
  return jsonl
    .filter((msg) => msg.type === 'user' || msg.type === 'assistant')
    .map((msg) => {
      // Generate a fallback ID if uuid is missing
      const id = msg.uuid || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const base = {
        id,
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
 * Validate and parse JSONB content data
 */
export function validateJsonbContentData(contentData: unknown): JsonlMessage[] {
  if (!Array.isArray(contentData)) {
    logger.warn({ contentData }, 'Content data is not an array');
    return [];
  }

  const validatedMessages: JsonlMessage[] = [];

  for (const [index, item] of contentData.entries()) {
    try {
      const validated = JsonlMessageSchema.parse(item);
      validatedMessages.push(validated);
    } catch (error) {
      logger.warn(
        {
          index,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to validate JSONB content data item',
      );
      // Skip invalid items
    }
  }

  return validatedMessages;
}
