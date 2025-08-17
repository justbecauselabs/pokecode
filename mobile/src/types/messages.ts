// Type aliases for message-related types
import type { GetMessagesResponse } from '../api/client';
import type { 
  Message, 
  UserMessage, 
  AssistantMessage,
  AssistantMessageMessage
} from '../schemas/message.schema';

// Re-export from schemas for compatibility
export type { Message } from '../schemas/message.schema';
export type { Session as SessionInfo } from '../schemas/session.schema';

// Full response type
export type { GetMessagesResponse };

// Helper types for the new Claude Code SDK message structure
export type ClaudeCodeSDKMessage = Message['data'];


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
    return '[System: message]';
  }
  
  if (message.type === 'result') {
    return '[Result: completed]';
  }
  
  return '[Unknown message type]';
};

// Helper function to get message role for styling
export const getMessageRole = (message: Message): 'user' | 'assistant' | 'system' | 'result' => {
  if (!message?.type) {
    console.warn('getMessageRole: message.type is undefined', message);
    return 'user'; // Default fallback
  }
  return message.type;
};
