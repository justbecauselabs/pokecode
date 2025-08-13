// JWT Token Payload
export interface TokenPayload {
  sub: string; // user ID
  email: string;
  iat?: number;
  exp?: number;
}

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: unknown) => Promise<void>;
    metrics?: {
      promptsTotal: MetricsCounter;
      activeSessionsGauge: MetricsGauge;
    };
    rateLimits?: {
      prompt: { max: number; timeWindow: string };
      file: { max: number; timeWindow: string };
      read: { max: number; timeWindow: string };
    };
  }
}

// API Response Types
export interface SessionResponse {
  id: string;
  userId: string;
  projectPath: string;
  context?: string;
  status: 'active' | 'idle' | 'expired';
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
}

// Prompt types removed - using message-based API now

export interface FileInfo {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
}

export interface ListFilesResponse {
  files: FileInfo[];
  basePath: string;
}

export interface GetFileResponse {
  path: string;
  content: string;
  encoding: string;
  size: number;
  mimeType: string;
  modifiedAt: string;
}

// Claude SDK Message Types
export type StopReason =
  | 'end_turn'
  | 'max_tokens'
  | 'stop_sequence'
  | 'tool_use'
  | 'pause_turn'
  | 'refusal';

// Message Content Types
export interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content?: string;
  is_error?: boolean;
}

export interface ThinkingContent {
  type: 'thinking';
  thinking: string;
}

export type MessageContent = TextContent | ToolUseContent | ToolResultContent | ThinkingContent;

// Claude Code Message Types
export interface BaseClaudeMessage {
  type: string;
  timestamp?: string;
}

export interface AssistantMessage extends BaseClaudeMessage {
  type: 'assistant';
  message: {
    content: MessageContent[];
    role: 'assistant';
  };
}

export interface UserMessage extends BaseClaudeMessage {
  type: 'user';
  message: {
    content: MessageContent[];
    role: 'user';
  };
}

export interface ThinkingMessage extends BaseClaudeMessage {
  type: 'thinking';
  data: {
    thinking: string;
  };
}

export interface CitationsDeltaMessage extends BaseClaudeMessage {
  type: 'citations_delta';
  data: {
    citation: Citation;
  };
}

export interface ToolUseMessage extends BaseClaudeMessage {
  type: 'tool_use';
  name: string;
  input: Record<string, unknown>;
}

export type ClaudeCodeMessage =
  | AssistantMessage
  | UserMessage
  | ThinkingMessage
  | CitationsDeltaMessage
  | ToolUseMessage;

// JSONL Message Types and IntermediateMessage are now imported from @/types/claude-messages

// Metrics Types
export interface MetricsCounter {
  inc(labels?: Record<string, string>): void;
}

export interface MetricsGauge {
  set(value: number, labels?: Record<string, string>): void;
  inc(labels?: Record<string, string>): void;
  dec(labels?: Record<string, string>): void;
}

// Citation Types
export interface CharLocationCitation {
  type: 'char_location';
  cited_text: string;
  start_char_index: number;
  end_char_index: number;
  document_index: number;
  document_title?: string;
  file_id?: string;
}

export interface PageLocationCitation {
  type: 'page_location';
  cited_text: string;
  start_page_number: number;
  end_page_number: number;
  document_index: number;
  document_title?: string;
  file_id?: string;
}

export interface ContentBlockLocationCitation {
  type: 'content_block_location';
  cited_text: string;
  start_block_index: number;
  end_block_index: number;
  document_index: number;
  document_title?: string;
  file_id?: string;
}

export interface SearchResultLocationCitation {
  type: 'search_result_location';
  cited_text: string;
  source: string;
  start_block_index: number;
  end_block_index: number;
  search_result_index: number;
  title?: string;
}

export interface WebSearchResultLocationCitation {
  type: 'web_search_result_location';
  cited_text: string;
  url: string;
  encrypted_index: string;
  title?: string;
}

export type Citation =
  | CharLocationCitation
  | PageLocationCitation
  | ContentBlockLocationCitation
  | SearchResultLocationCitation
  | WebSearchResultLocationCitation;

// Content Block Types
export interface TextContentBlock {
  type: 'text';
  text: string;
  citations?: Citation[];
}

export interface ThinkingContentBlock {
  type: 'thinking';
  thinking: string;
  signature: string;
}

export interface RedactedThinkingContentBlock {
  type: 'redacted_thinking';
  data: unknown;
}

export interface ToolUseContentBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ServerToolUseContentBlock {
  type: 'server_tool_use';
  id: string;
  name: 'web_search';
  input: Record<string, unknown>;
}

export interface WebSearchResult {
  type: 'web_search_result';
  url: string;
  title: string;
  encrypted_content: string;
  page_age?: number;
}

export interface WebSearchToolResultError {
  type: 'web_search_tool_result_error';
  error_code:
    | 'invalid_tool_input'
    | 'unavailable'
    | 'max_uses_exceeded'
    | 'too_many_requests'
    | 'query_too_long';
}

export interface WebSearchToolResultContentBlock {
  type: 'web_search_tool_result';
  tool_use_id: string;
  content: WebSearchResult[] | WebSearchToolResultError;
}

export type ContentBlock =
  | TextContentBlock
  | ThinkingContentBlock
  | RedactedThinkingContentBlock
  | ToolUseContentBlock
  | ServerToolUseContentBlock
  | WebSearchToolResultContentBlock;

// Delta Types
export interface TextDelta {
  type: 'text_delta';
  text: string;
}

export interface ThinkingDelta {
  type: 'thinking_delta';
  thinking: string;
}

export interface CitationsDelta {
  type: 'citations_delta';
  citation: Citation;
}

export interface InputJsonDelta {
  type: 'input_json_delta';
  partial_json: string;
}

export interface SignatureDelta {
  type: 'signature_delta';
  signature: string;
}

export type Delta = TextDelta | ThinkingDelta | CitationsDelta | InputJsonDelta | SignatureDelta;

// Streaming Event Types
export interface MessageStartEvent {
  type: 'message_start';
  message: {
    id: string;
    type: 'message';
    role: 'assistant';
    model: string;
    content: [];
    stop_reason: null;
    stop_sequence: null;
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

export interface ContentBlockStartEvent {
  type: 'content_block_start';
  index: number;
  content_block: ContentBlock;
}

export interface ContentBlockDeltaEvent {
  type: 'content_block_delta';
  index: number;
  delta: Delta;
}

export interface ContentBlockStopEvent {
  type: 'content_block_stop';
  index: number;
}

export interface MessageDeltaEvent {
  type: 'message_delta';
  delta: {
    stop_reason?: StopReason;
    stop_sequence?: string;
    usage?: {
      output_tokens: number;
    };
  };
}

export interface MessageStopEvent {
  type: 'message_stop';
}

export type MessageStreamEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageDeltaEvent
  | MessageStopEvent;

// Legacy SSE Event Types (for compatibility)
export interface StreamEvent {
  id?: string;
  event:
    | 'message'
    | 'tool_use'
    | 'tool_result'
    | 'error'
    | 'complete'
    | 'message_start'
    | 'content_block_start'
    | 'content_block_delta'
    | 'content_block_stop'
    | 'message_delta'
    | 'message_stop'
    | 'thinking'
    | 'citations'
    | 'web_search_result';
  data: string; // JSON stringified payload
}

export interface MessageEvent {
  type: 'message';
  content: string;
  timestamp: string;
}

export interface ThinkingEvent {
  type: 'thinking';
  thinking: string;
  signature?: string;
  timestamp: string;
}

export interface CitationsEvent {
  type: 'citations';
  citations: Citation[];
  timestamp: string;
}

export interface ToolUseEvent {
  type: 'tool_use';
  tool: string;
  params: Record<string, unknown>;
  timestamp: string;
}

export interface ToolResultEvent {
  type: 'tool_result';
  tool: string;
  result: string;
  timestamp: string;
}

export interface WebSearchResultEvent {
  type: 'web_search_result';
  tool_use_id: string;
  results: WebSearchResult[];
  timestamp: string;
}

export interface CompleteEvent {
  type: 'complete';
  summary: {
    duration: number;
    tokenCount?: number;
    toolCallCount: number;
    stop_reason?: StopReason;
  };
  timestamp: string;
}

export interface ErrorEvent {
  type: 'error';
  error: string;
  error_code?: string;
  timestamp: string;
}

// Queue Job Types
export interface PromptJobData {
  sessionId: string;
  promptId: string;
  prompt: string;
  allowedTools?: string[];
  projectPath: string;
  messageId?: string; // ID of the user message record in database
}

// Error Types
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(
    message: string,
    public errors?: unknown,
  ) {
    super(400, message, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Authentication required') {
    super(401, message, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = 'Insufficient permissions') {
    super(403, message, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends ApiError {
  constructor(message = 'Rate limit exceeded') {
    super(429, message, 'RATE_LIMIT_ERROR');
  }
}
