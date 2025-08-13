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
  // Handle both single items and arrays
  const items = Array.isArray(contentData) ? contentData : [contentData];

  const validatedMessages: JsonlMessage[] = [];

  for (const [index, item] of items.entries()) {
    try {
      // Try to parse as standard JSONL message first
      const validated = JsonlMessageSchema.parse(item);
      validatedMessages.push(validated);
    } catch (error) {
      // If that fails, try to convert SDK format to JSONL format
      try {
        const converted = convertSdkToJsonl(item);
        if (converted) {
          const validated = JsonlMessageSchema.parse(converted);
          validatedMessages.push(validated);
        }
      } catch (conversionError) {
        logger.warn(
          {
            index,
            error: error instanceof Error ? error.message : String(error),
            conversionError:
              conversionError instanceof Error ? conversionError.message : String(conversionError),
          },
          'Failed to validate or convert JSONB content data item',
        );
      }
    }
  }

  return validatedMessages;
}

/**
 * Convert SDK message format to JSONL format
 */
function convertSdkToJsonl(sdkMessage: any): JsonlMessage | null {
  if (!sdkMessage || typeof sdkMessage !== 'object') {
    return null;
  }

  // Generate missing fields for SDK messages
  const baseFields = {
    uuid: sdkMessage.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    parentUuid: null,
    sessionId: sdkMessage.session_id || '',
    timestamp: sdkMessage.timestamp || new Date().toISOString(),
    isSidechain: false,
    userType: 'external' as const,
    cwd: '/unknown',
    version: '1.0.0',
    gitBranch: 'main',
  };

  // Handle user messages
  if (sdkMessage.type === 'user') {
    return {
      ...baseFields,
      type: 'user' as const,
      message: {
        role: 'user' as const,
        content: sdkMessage.content || sdkMessage.message?.content || '',
      },
    };
  }

  // Handle assistant messages
  if (sdkMessage.type === 'assistant' && sdkMessage.message) {
    return {
      ...baseFields,
      type: 'assistant' as const,
      message: {
        role: 'assistant' as const,
        content: sdkMessage.message.content || [],
        id: sdkMessage.message.id || baseFields.uuid,
        type: 'message' as const,
        model: sdkMessage.message.model || 'claude-unknown',
        stop_reason: sdkMessage.message.stop_reason || null,
        stop_sequence: sdkMessage.message.stop_sequence || null,
        usage: sdkMessage.message.usage || {
          input_tokens: 0,
          cache_read_input_tokens: 0,
          output_tokens: 0,
          service_tier: null,
        },
      },
      requestId: sdkMessage.requestId,
      toolUseResult: sdkMessage.toolUseResult,
    };
  }

  return null;
}
