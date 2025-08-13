// Type aliases for message-related types
import type { GetApiClaudeCodeSessionsBySessionIdMessagesResponse } from '../api/generated';

// Extract the Message type from the generated response type
export type Message = GetApiClaudeCodeSessionsBySessionIdMessagesResponse['messages'][number];

// Extract the ChildMessage type
export type ChildMessage = Message['children'][number];

// Extract the Session type
export type SessionInfo = GetApiClaudeCodeSessionsBySessionIdMessagesResponse['session'];

// Full response type
export type GetMessagesResponse = GetApiClaudeCodeSessionsBySessionIdMessagesResponse;
