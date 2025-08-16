import type { SDKMessage } from '@anthropic-ai/claude-code';
import type { SessionMessage } from '../db/schema-sqlite/session_messages';
import type { Message as NewMessage } from '../schemas/message.schema';
import type {
  ClaudeCodeSDKAssistantMessage,
  ClaudeCodeSDKMessage,
  ClaudeCodeSDKResultMessage,
  ClaudeCodeSDKSystemMessage,
  ClaudeCodeSDKUserMessage,
  Message,
} from '../schemas/messages-deprecated.schema';
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
 * Parse user message from SDK format
 */
function parseUserMessage(
  dbMessage: SessionMessage,
  sdkMessage: SDKMessage & { type: 'user' },
): NewMessage | null {
  if (sdkMessage.message?.content && typeof sdkMessage.message.content === 'string') {
    return {
      id: dbMessage.id,
      type: 'user',
      data: {
        content: sdkMessage.message.content,
      },
      parentToolUseId: sdkMessage.parent_tool_use_id,
    };
  }
  return null;
}

/**
 * Parse TodoWrite tool use from content blocks
 */
function parseTodoWriteToolUse(toolUseBlocks: Array<{ type: string; name?: string }>): {
  todos: Array<{ content: string; status: 'completed' | 'pending' | 'in_progress'; id: string }>;
} | null {
  const todoWriteBlock = toolUseBlocks.find(
    (block: { type: string; name?: string }) => block.name === 'TodoWrite',
  );

  if (todoWriteBlock) {
    const toolBlock = todoWriteBlock as {
      type: string;
      name: string;
      input?: {
        todos?: Array<{
          content: string;
          status: 'completed' | 'pending' | 'in_progress';
          id: string;
        }>;
      };
    };

    if (toolBlock.input?.todos) {
      return { todos: toolBlock.input.todos };
    }
  }
  return null;
}

/**
 * Extract text content from assistant message content blocks
 */
function extractTextContent(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter(
      (block: { type: string; text?: string }): block is { type: string; text: string } =>
        block.type === 'text' && typeof block.text === 'string',
    )
    .map((block: { type: string; text: string }) => block.text)
    .join('\n');
}

/**
 * Parse assistant message from SDK format
 */
function parseAssistantMessage(
  dbMessage: SessionMessage,
  sdkMessage: SDKMessage & { type: 'assistant' },
): NewMessage | null {
  if (!Array.isArray(sdkMessage.message?.content)) {
    return null;
  }

  // Check for tool use calls first
  const toolUseBlocks = sdkMessage.message.content.filter(
    (block: { type: string; name?: string }) => block.type === 'tool_use',
  );

  if (toolUseBlocks.length > 0) {
    // Handle TodoWrite tool specifically
    const todoData = parseTodoWriteToolUse(toolUseBlocks);
    if (todoData) {
      return {
        id: dbMessage.id,
        type: 'assistant',
        data: {
          type: 'tool_use',
          data: {
            type: 'todo',
            data: todoData,
          },
        },
        parentToolUseId: sdkMessage.parent_tool_use_id,
      };
    }
  }

  // Fallback to text content extraction
  const textContent = extractTextContent(sdkMessage.message.content);
  if (textContent) {
    return {
      id: dbMessage.id,
      type: 'assistant',
      data: {
        type: 'message',
        data: {
          content: textContent,
        },
      },
      parentToolUseId: sdkMessage.parent_tool_use_id,
    };
  }

  return null;
}

/**
 * Parse DB message to new Message format
 */
export function parseDbMessage(dbMessage: SessionMessage): NewMessage | null {
  try {
    // Parse the contentData JSON string to get the SDK message
    if (!dbMessage.contentData) {
      return null;
    }

    const sdkMessage = JSON.parse(dbMessage.contentData);

    // Check if it's a user message with text content
    if (dbMessage.type === 'user' && sdkMessage.type === 'user') {
      return parseUserMessage(dbMessage, sdkMessage as SDKMessage & { type: 'user' });
    }

    // Check if it's an assistant message
    if (dbMessage.type === 'assistant' && sdkMessage.type === 'assistant') {
      return parseAssistantMessage(dbMessage, sdkMessage as SDKMessage & { type: 'assistant' });
    }

    return null;
  } catch (error) {
    logger.warn(
      {
        error: error instanceof Error ? error.message : String(error),
        dbMessage,
      },
      'Failed to parse DB message',
    );
    return null;
  }
}

/**
 * Extract simple text content from new Message format for display purposes
 */
export function extractNewMessageText(message: NewMessage): string {
  try {
    if (message.type === 'user') {
      const userData = message.data as { content: string };
      return userData.content;
    }

    if (message.type === 'assistant') {
      const assistantData = message.data as {
        type: 'message' | 'tool_use';
        data: unknown;
      };

      if (assistantData.type === 'message') {
        const messageData = assistantData.data as { content: string };
        return messageData.content;
      }

      if (assistantData.type === 'tool_use') {
        const toolData = assistantData.data as {
          type: string;
          data: unknown;
        };

        if (toolData.type === 'todo') {
          return '[Todo list updated]';
        }

        return '[Tool used]';
      }
    }

    if (message.type === 'system') {
      return '[System message]';
    }

    if (message.type === 'result') {
      return '[Result message]';
    }

    return '[Unknown message type]';
  } catch (error) {
    logger.warn(
      {
        error: error instanceof Error ? error.message : String(error),
        messageId: message.id,
      },
      'Failed to extract text from new message format',
    );
    return '[Failed to extract content]';
  }
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
