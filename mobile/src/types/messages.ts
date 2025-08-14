// Type aliases for message-related types
import type { GetApiClaudeCodeSessionsBySessionIdMessagesResponse } from '../api/generated';

// Extract the Message type from the generated response type
export type Message = GetApiClaudeCodeSessionsBySessionIdMessagesResponse['messages'][number];

// Extract the Session type
export type SessionInfo = GetApiClaudeCodeSessionsBySessionIdMessagesResponse['session'];

// Full response type
export type GetMessagesResponse = GetApiClaudeCodeSessionsBySessionIdMessagesResponse;

// Helper types for easier component handling
export type ToolCall = NonNullable<Message['toolCalls']>[number];
export type ToolResult = NonNullable<Message['toolResults']>[number];
export type Citation = NonNullable<Message['citations']>[number];
export type WebSearchResult = NonNullable<Message['webSearchResults']>[number];
export type Usage = NonNullable<Message['usage']>;
export type SystemMetadata = NonNullable<Message['systemMetadata']>;
export type ResultMetadata = NonNullable<Message['resultMetadata']>;
