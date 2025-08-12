import {
  type IntermediateMessage,
  IntermediateMessageSchema,
  type JsonlMessage,
  JsonlMessageSchema,
} from '../types/claude-messages';
import { logger } from './logger';

/**
 * Strict message validation utilities using Zod
 * Throws errors for invalid messages - no fallback handling
 */

export class MessageValidator {
  /**
   * Parse and validate a JSONL message with strict Zod validation
   * @param rawData - Raw parsed JSON data from JSONL line
   * @param lineIndex - Line number for error context
   * @param filePath - File path for error context
   * @returns Validated message
   * @throws {Error} If validation fails
   */
  static parseJsonlMessage(rawData: unknown, lineIndex?: number, filePath?: string): JsonlMessage {
    try {
      const validatedMessage = JsonlMessageSchema.parse(rawData);

      logger.debug(
        {
          filePath,
          lineIndex,
          messageType: validatedMessage.type,
          messageUuid: 'uuid' in validatedMessage ? validatedMessage.uuid : 'N/A',
        },
        'JSONL message validation successful',
      );

      return validatedMessage;
    } catch (error) {
      const context = lineIndex !== undefined ? ` at line ${lineIndex}` : '';
      const file = filePath ? ` in file ${filePath}` : '';

      logger.error(
        {
          filePath,
          lineIndex,
          error: error instanceof Error ? error.message : String(error),
          rawDataKeys:
            typeof rawData === 'object' && rawData !== null
              ? Object.keys(rawData)
              : 'not-an-object',
        },
        `JSONL message validation failed${context}${file}`,
      );

      throw new Error(
        `Invalid JSONL message format${context}${file}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Parse and validate an intermediate message format
   * @param rawData - Raw intermediate message data
   * @returns Validated intermediate message
   * @throws {Error} If validation fails
   */
  static parseIntermediateMessage(rawData: unknown): IntermediateMessage {
    try {
      return IntermediateMessageSchema.parse(rawData);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          rawDataType: typeof rawData,
        },
        'Intermediate message validation failed',
      );

      throw new Error(
        `Invalid intermediate message format: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Extract content from a validated JSONL message
   * @param msg - Validated JSONL message
   * @returns Extracted content string
   */
  static extractContent(msg: JsonlMessage): string {
    return MessageValidator.extractContentFromValidatedMessage(msg);
  }

  /**
   * Extract content from a validated JSONL message
   * @private
   */
  private static extractContentFromValidatedMessage(msg: JsonlMessage): string {
    if (msg.type === 'summary') {
      return msg.summary;
    }

    if (!('message' in msg) || !msg.message) {
      return '';
    }

    const message = msg.message;
    let content = '';

    if (typeof message.content === 'string') {
      content = message.content;
    } else if (Array.isArray(message.content)) {
      content = message.content
        .map((item) => {
          if (typeof item === 'object' && item !== null) {
            if ('type' in item && 'text' in item && item.type === 'text') {
              return String(item.text);
            }
            if ('type' in item && 'name' in item && item.type === 'tool_use') {
              return `[Tool: ${String(item.name)}]`;
            }
          }
          return '';
        })
        .filter(Boolean)
        .join(' ');
    }

    // Add tool use result if present (for assistant messages)
    if (msg.type === 'assistant' && 'toolUseResult' in msg && msg.toolUseResult) {
      content += content
        ? `\n\n[Tool Result]\n${msg.toolUseResult}`
        : `[Tool Result]\n${msg.toolUseResult}`;
    }

    return content;
  }

  /**
   * Convert a validated JSONL message to intermediate message format
   * @param msg - Validated JSONL message
   * @returns Intermediate message format
   */
  static toIntermediateMessage(msg: JsonlMessage): IntermediateMessage {
    if (msg.type === 'summary') {
      return {
        id: msg.leafUuid,
        content: msg.summary,
        role: 'system' as const,
        type: 'summary',
        timestamp: new Date().toISOString(),
        metadata: {},
      };
    }

    return {
      id: msg.uuid,
      content: MessageValidator.extractContentFromValidatedMessage(msg),
      role: msg.type as 'user' | 'assistant',
      type: msg.type,
      timestamp: msg.timestamp,
      metadata: {
        parentUuid: msg.parentUuid,
        sessionId: msg.sessionId,
        isSidechain: msg.isSidechain,
        userType: msg.userType,
        requestId: msg.type === 'assistant' ? msg.requestId : undefined,
        toolUseResult: msg.type === 'assistant' ? msg.toolUseResult : undefined,
      },
    };
  }
}

export default MessageValidator;
