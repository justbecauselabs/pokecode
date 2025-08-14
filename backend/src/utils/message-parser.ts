import type { SDKMessage } from '@anthropic-ai/claude-code';
import type { ApiMessage } from '@/schemas/message.schema';
import { logger } from './logger';

/**
 * Convert SDK message to API format
 */
export function sdkToApiMessage(
  sdkMessage: SDKMessage,
  dbMessageId: string,
  sessionId: string,
  timestamp: Date,
): ApiMessage | null {
  try {
    // Determine message type and role
    let role: 'user' | 'assistant' = 'assistant';
    if (sdkMessage.type === 'user') {
      role = 'user';
    }

    // Extract content based on message structure
    let content = '';
    let toolCalls: Array<{ name: string; input: any }> | undefined;
    let toolResults: Array<{ tool_use_id: string; content: string }> | undefined;
    let thinking: string | undefined;

    if (sdkMessage.type === 'user') {
      // Handle user messages
      if (typeof sdkMessage.content === 'string') {
        content = sdkMessage.content;
      } else if (sdkMessage.message?.content) {
        if (typeof sdkMessage.message.content === 'string') {
          content = sdkMessage.message.content;
        } else if (Array.isArray(sdkMessage.message.content)) {
          // Extract text and tool results from array content
          const textParts = sdkMessage.message.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .filter(Boolean);
          content = textParts.join('\n');

          // Extract tool results
          const results = sdkMessage.message.content
            .filter((c: any) => c.type === 'tool_result')
            .map((c: any) => ({
              tool_use_id: c.tool_use_id,
              content: c.content || '',
            }));
          if (results.length > 0) {
            toolResults = results;
          }
        }
      }
    } else if (sdkMessage.type === 'assistant' && sdkMessage.message?.content) {
      // Handle assistant messages
      if (Array.isArray(sdkMessage.message.content)) {
        // Extract text content
        const textParts = sdkMessage.message.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .filter(Boolean);
        content = textParts.join('\n');

        // Extract tool calls
        const calls = sdkMessage.message.content
          .filter((c: any) => c.type === 'tool_use')
          .map((c: any) => ({
            name: c.name,
            input: c.input,
          }));
        if (calls.length > 0) {
          toolCalls = calls;
        }

        // Extract thinking
        const thinkingParts = sdkMessage.message.content
          .filter((c: any) => c.type === 'thinking')
          .map((c: any) => c.thinking)
          .filter(Boolean);
        if (thinkingParts.length > 0) {
          thinking = thinkingParts.join('\n');
        }
      }
    }

    return {
      id: dbMessageId,
      sessionId,
      role,
      content: content || '[No content]',
      timestamp: timestamp.toISOString(),
      ...(toolCalls && { toolCalls }),
      ...(toolResults && { toolResults }),
      ...(thinking && { thinking }),
    };
  } catch (error) {
    logger.warn(
      {
        error: error instanceof Error ? error.message : String(error),
        messageType: sdkMessage.type,
      },
      'Failed to convert SDK message to API format',
    );
    return null;
  }
}

/**
 * Simple validation to check if data is a valid SDK message
 */
export function isValidSDKMessage(data: unknown): data is SDKMessage {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const msg = data as any;
  
  // Check if it has basic SDK message structure
  return (
    typeof msg.type === 'string' &&
    (msg.type === 'user' || msg.type === 'assistant' || msg.type === 'thinking' || msg.type === 'tool_result')
  );
}
