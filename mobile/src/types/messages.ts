// Type aliases for message-related types

import type {
  AssistantMessage,
  AssistantMessageMessage,
  ErrorMessage,
  Message,
  UserMessage,
} from '@pokecode/api';
import type { GetMessagesResponse } from '@pokecode/api';

// Re-export from schemas for compatibility
export type { Message, Session as SessionInfo } from '@pokecode/api';

// Full response type
export type { GetMessagesResponse };

// Helper function to extract text content from various message types
export const extractMessageText = (message: Message): string => {
  if (!message?.data) {
    console.warn('extractMessageText: message.data is undefined', message);
    return '[Invalid message data]';
  }

  if (message.type === 'user') {
    const userMsg = message.data as UserMessage;
    return userMsg.content;
  }

  if (message.type === 'assistant') {
    const assistantMsg = message.data as AssistantMessage;
    if (assistantMsg.type === 'message') {
      const messageData = assistantMsg.data as AssistantMessageMessage;
      return messageData.content;
    }
    return '';
  }

  if (message.type === 'system') {
    return '[System message]';
  }

  if (message.type === 'result') {
    return '[Result completed]';
  }

  if (message.type === 'error') {
    const errorMsg = message.data as ErrorMessage;
    return errorMsg.message;
  }

  return '[Unknown message type]';
};

// Helper function to get message role for styling
export const getMessageRole = (
  message: Message
): 'user' | 'assistant' | 'system' | 'result' | 'error' => {
  if (!message?.type) {
    console.warn('getMessageRole: message.type is undefined', message);
    return 'user'; // Default fallback
  }
  return message.type;
};
