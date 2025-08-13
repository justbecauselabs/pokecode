/**
 * API types that match the backend message schema
 * These types are aligned with the backend's message.schema.ts
 */

// Core message types matching backend
export interface ApiMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  claudeSessionId?: string;
  children: ApiChildMessage[];
}

export interface ApiChildMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: Array<{
    name: string;
    input: any;
  }>;
  toolResults?: Array<{
    tool_use_id: string;
    content: string;
  }>;
  thinking?: string;
}

// Session info in response
export interface SessionInfo {
  id: string;
  isWorking: boolean;
  currentJobId?: string | null;
  lastJobStatus?: string | null;
  status: 'active' | 'inactive' | 'archived';
}

// Request/Response types
export interface CreateMessageRequest {
  content: string;
  allowedTools?: string[];
}

export interface CreateMessageResponse {
  message: ApiMessage;
}

export interface GetMessagesResponse {
  messages: ApiMessage[];
  session: SessionInfo;
}