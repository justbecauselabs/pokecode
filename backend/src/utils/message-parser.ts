import type {
  ClaudeCodeSDKAssistantMessage,
  ClaudeCodeSDKMessage,
  ClaudeCodeSDKResultMessage,
  ClaudeCodeSDKSystemMessage,
  ClaudeCodeSDKUserMessage,
  Message,
} from '../schemas/message.schema';
import { logger } from './logger';

/**
 * Extract token count from an SDK message
 */
export function extractTokenCount(sdkMessage: ClaudeCodeSDKMessage): number {
  try {
    if (sdkMessage.type === 'assistant') {
      const assistantMsg = sdkMessage as ClaudeCodeSDKAssistantMessage;
      if (assistantMsg.message?.usage) {
        // Return total tokens (input + output)
        return assistantMsg.message.usage.input_tokens + assistantMsg.message.usage.output_tokens;
      }
    } else if (sdkMessage.type === 'result') {
      const resultMsg = sdkMessage as ClaudeCodeSDKResultMessage;
      if (resultMsg.usage) {
        // Return total tokens (input + output)
        return resultMsg.usage.input_tokens + resultMsg.usage.output_tokens;
      }
    }
    return 0;
  } catch (error) {
    logger.warn(
      {
        error: error instanceof Error ? error.message : String(error),
        messageType: sdkMessage.type,
      },
      'Failed to extract token count from SDK message',
    );
    return 0;
  }
}

/**
 * Convert SDK message to new Message wrapper format
 */
export function sdkToMessage(sdkMessage: ClaudeCodeSDKMessage, dbMessageId: string): Message {
  return {
    id: dbMessageId,
    type: 'claude-code',
    data: sdkMessage,
  };
}

/**
 * Extract simple text content from a Message for display purposes
 */
export function extractMessageText(message: Message): string {
  try {
    const sdkMessage = message.data;

    if (sdkMessage.type === 'user') {
      const userMsg = sdkMessage as ClaudeCodeSDKUserMessage;
      if (typeof userMsg.message.content === 'string') {
        return userMsg.message.content;
      }
      if (Array.isArray(userMsg.message.content)) {
        // Extract text parts from content blocks
        return userMsg.message.content
          .filter(
            (block): block is { type: 'text'; text: string } =>
              typeof block === 'object' &&
              block !== null &&
              'type' in block &&
              block.type === 'text' &&
              'text' in block &&
              typeof block.text === 'string',
          )
          .map((block) => block.text)
          .join('\n');
      }
      return '';
    }

    if (sdkMessage.type === 'assistant') {
      const assistantMsg = sdkMessage as ClaudeCodeSDKAssistantMessage;
      if (Array.isArray(assistantMsg.message.content)) {
        // Extract text from content blocks
        return assistantMsg.message.content
          .filter(
            (block): block is { type: 'text'; text: string } =>
              typeof block === 'object' &&
              block !== null &&
              'type' in block &&
              block.type === 'text' &&
              'text' in block &&
              typeof block.text === 'string',
          )
          .map((block) => block.text)
          .join('\n');
      }
      return '';
    }

    if (sdkMessage.type === 'system') {
      const systemMsg = sdkMessage as ClaudeCodeSDKSystemMessage;
      return `[System: ${systemMsg.subtype}]`;
    }

    if (sdkMessage.type === 'result') {
      const resultMsg = sdkMessage as ClaudeCodeSDKResultMessage;
      if (resultMsg.subtype === 'success' && 'result' in resultMsg) {
        return resultMsg.result || '[Result completed]';
      }
      return `[Error: ${resultMsg.subtype}]`;
    }

    return '[Unknown message type]';
  } catch (error) {
    logger.warn(
      {
        error: error instanceof Error ? error.message : String(error),
        messageId: message.id,
      },
      'Failed to extract text from message',
    );
    return '[Failed to extract content]';
  }
}
