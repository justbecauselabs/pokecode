// Type aliases for message-related types
import type { GetApiClaudeCodeSessionsBySessionIdMessagesResponse } from '../api/generated';

// Extract the Message type from the generated response type
export type Message = GetApiClaudeCodeSessionsBySessionIdMessagesResponse['messages'][number];

// Extract the Session type
export type SessionInfo = GetApiClaudeCodeSessionsBySessionIdMessagesResponse['session'];

// Full response type
export type GetMessagesResponse = GetApiClaudeCodeSessionsBySessionIdMessagesResponse;

// Helper types for the new Claude Code SDK message structure
export type ClaudeCodeSDKMessage = Message['data'];

// Helper function to extract text content from various message types
export const extractMessageText = (message: Message): string => {
  if (!message?.data) {
    console.warn('extractMessageText: message.data is undefined', message);
    return '[Invalid message data]';
  }
  
  const sdkMessage = message.data;
  
  if (sdkMessage.type === 'user') {
    const userMsg = sdkMessage as any;
    if (typeof userMsg.message?.content === 'string') {
      return userMsg.message.content;
    }
    if (Array.isArray(userMsg.message?.content)) {
      return userMsg.message.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
    }
    return '';
  }
  
  if (sdkMessage.type === 'assistant') {
    const assistantMsg = sdkMessage as any;
    if (Array.isArray(assistantMsg.message?.content)) {
      return assistantMsg.message.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
    }
    return '';
  }
  
  if (sdkMessage.type === 'system') {
    return `[System: ${(sdkMessage as any).subtype || 'message'}]`;
  }
  
  if (sdkMessage.type === 'result') {
    const resultMsg = sdkMessage as any;
    return resultMsg.result || `[Result: ${resultMsg.subtype || 'completed'}]`;
  }
  
  return '[Unknown message type]';
};

// Helper function to get message role for styling
export const getMessageRole = (message: Message): 'user' | 'assistant' | 'system' | 'result' => {
  if (!message?.data?.type) {
    console.warn('getMessageRole: message.data.type is undefined', message);
    return 'user'; // Default fallback
  }
  return message.data.type;
};
