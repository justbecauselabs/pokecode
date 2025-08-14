# Claude Code SDK Message Types

/**
 * This file contains the TypeScript type definitions for `SDKMessage` 
 * and all of its constituent or related types, compiled from the Anthropic SDK.
 */

export type SDKMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKResultMessage
  | SDKSystemMessage;

//
// SDK-Specific High-Level Types
//

export type SDKAssistantMessage = {
  type: 'assistant';
  message: APIAssistantMessage;
  parent_tool_use_id: string | null;
  session_id: string;
};

export type SDKUserMessage = {
  type: 'user';
  message: APIUserMessage;
  parent_tool_use_id: string | null;
  session_id: string;
};

export type SDKResultMessage =
  | {
      type: 'result';
      subtype: 'success';
      duration_ms: number;
      duration_api_ms: number;
      is_error: boolean;
      num_turns: number;
      result: string;
      session_id: string;
      total_cost_usd: number;
      usage: NonNullableUsage;
    }
  | {
      type: 'result';
      subtype: 'error_max_turns' | 'error_during_execution';
      duration_ms: number;
      duration_api_ms: number;
      is_error: boolean;
      num_turns: number;
      session_id: string;
      total_cost_usd: number;
      usage: NonNullableUsage;
    };

export type SDKSystemMessage = {
  type: 'system';
  subtype: 'init';
  apiKeySource: ApiKeySource;
  cwd: string;
  session_id: string;
  tools: string[];
  mcp_servers: {
    name: string;
    status: string;
  }[];
  model: string;
  permissionMode: PermissionMode;
  slash_commands: string[];
};

//
// SDK-Specific Supporting Types
//

export type ApiKeySource = 'user' | 'project' | 'org' | 'temporary';

export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'plan';

export type NonNullableUsage = {
  [K in keyof Usage]: NonNullable<Usage[K]>;
};


//
// Type Aliases for Anthropic API Types
//

export type APIAssistantMessage = Message;
export type APIUserMessage = MessageParam;

//
// Anthropic API Core Message & Parameter Types
//

export interface Message {
  id: string;
  content: Array<ContentBlock>;
  model: Model;
  role: 'assistant';
  stop_reason: StopReason | null;
  stop_sequence: string | null;
  type: 'message';
  usage: Usage;
}

export interface MessageParam {
  content: string | Array<ContentBlockParam>;
  role: 'user' | 'assistant';
}

export interface Usage {
  cache_creation: CacheCreation | null;
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;
  input_tokens: number;
  output_tokens: number;
  server_tool_use: ServerToolUsage | null;
  service_tier: 'standard' | 'priority' | 'batch' | null;
}

export interface CacheCreation {
  ephemeral_1h_input_tokens: number;
  ephemeral_5m_input_tokens: number;
}

export interface ServerToolUsage {
  web_search_requests: number;
}

export type Model =
  | 'claude-3-7-sonnet-latest'
  | 'claude-3-7-sonnet-20250219'
  | 'claude-3-5-haiku-latest'
  | 'claude-3-5-haiku-20241022'
  | 'claude-sonnet-4-20250514'
  | 'claude-sonnet-4-0'
  | 'claude-4-sonnet-20250514'
  | 'claude-3-5-sonnet-latest'
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-5-sonnet-20240620'
  | 'claude-opus-4-0'
  | 'claude-opus-4-20250514'
  | 'claude-4-opus-20250514'
  | 'claude-opus-4-1-20250805'
  | 'claude-3-opus-latest'
  | 'claude-3-opus-20240229'
  | 'claude-3-haiku-20240307'
  | (string & {});

export type StopReason = 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | 'pause_turn' | 'refusal';

//
// Content Block & Parameter Types
//

export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | RedactedThinkingBlock
  | ToolUseBlock
  | ServerToolUseBlock
  | WebSearchToolResultBlock;

export type ContentBlockParam =
  | TextBlockParam
  | ImageBlockParam
  | DocumentBlockParam
  | SearchResultBlockParam
  | ThinkingBlockParam
  | RedactedThinkingBlockParam
  | ToolUseBlockParam
  | ToolResultBlockParam
  | ServerToolUseBlockParam
  | WebSearchToolResultBlockParam;

export interface TextBlock {
  citations: Array<TextCitation> | null;
  text: string;
  type: 'text';
}

export interface ThinkingBlock {
  signature: string;
  thinking: string;
  type: 'thinking';
}

export interface RedactedThinkingBlock {
  data: string;
  type: 'redacted_thinking';
}

export interface ToolUseBlock {
  id: string;
  input: unknown;
  name: string;
  type: 'tool_use';
}

export interface ServerToolUseBlock {
  id: string;
  input: unknown;
  name: 'web_search';
  type: 'server_tool_use';
}

export interface WebSearchToolResultBlock {
  content: WebSearchToolResultBlockContent;
  tool_use_id: string;
  type: 'web_search_tool_result';
}

export interface TextBlockParam {
  text: string;
  type: 'text';
  cache_control?: CacheControlEphemeral | null;
  citations?: Array<TextCitationParam> | null;
}

export interface ImageBlockParam {
  source: Base64ImageSource | URLImageSource;
  type: 'image';
  cache_control?: CacheControlEphemeral | null;
}

export interface DocumentBlockParam {
  source: Base64PDFSource | PlainTextSource | ContentBlockSource | URLPDFSource;
  type: 'document';
  cache_control?: CacheControlEphemeral | null;
  citations?: CitationsConfigParam;
  context?: string | null;
  title?: string | null;
}

export interface SearchResultBlockParam {
  content: Array<TextBlockParam>;
  source: string;
  title: string;
  type: 'search_result';
  cache_control?: CacheControlEphemeral | null;
  citations?: CitationsConfigParam;
}

export interface ThinkingBlockParam {
  signature: string;
  thinking: string;
  type: 'thinking';
}

export interface RedactedThinkingBlockParam {
  data: string;
  type: 'redacted_thinking';
}

export interface ToolUseBlockParam {
  id: string;
  input: unknown;
  name: string;
  type: 'tool_use';
  cache_control?: CacheControlEphemeral | null;
}

export interface ToolResultBlockParam {
  tool_use_id: string;
  type: 'tool_result';
  cache_control?: CacheControlEphemeral | null;
  content?: string | Array<TextBlockParam | ImageBlockParam | SearchResultBlockParam>;
  is_error?: boolean;
}

export interface ServerToolUseBlockParam {
  id: string;
  input: unknown;
  name: 'web_search';
  type: 'server_tool_use';
  cache_control?: CacheControlEphemeral | null;
}

export interface WebSearchToolResultBlockParam {
  content: WebSearchToolResultBlockParamContent;
  tool_use_id: string;
  type: 'web_search_tool_result';
  cache_control?: CacheControlEphemeral | null;
}

//
// Citation Types
//

export type TextCitation =
  | CitationCharLocation
  | CitationPageLocation
  | CitationContentBlockLocation
  | CitationsWebSearchResultLocation
  | CitationsSearchResultLocation;

export type TextCitationParam =
  | CitationCharLocationParam
  | CitationPageLocationParam
  | CitationContentBlockLocationParam
  | CitationWebSearchResultLocationParam
  | CitationSearchResultLocationParam;

export interface CitationCharLocation {
  cited_text: string;
  document_index: number;
  document_title: string | null;
  end_char_index: number;
  file_id: string | null;
  start_char_index: number;
  type: 'char_location';
}

export interface CitationPageLocation {
  cited_text: string;
  document_index: number;
  document_title: string | null;
  end_page_number: number;
  file_id: string | null;
  start_page_number: number;
  type: 'page_location';
}

export interface CitationContentBlockLocation {
  cited_text: string;
  document_index: number;
  document_title: string | null;
  end_block_index: number;
  file_id: string | null;
  start_block_index: number;
  type: 'content_block_location';
}

export interface CitationsWebSearchResultLocation {
  cited_text: string;
  encrypted_index: string;
  title: string | null;
  type: 'web_search_result_location';
  url: string;
}

export interface CitationsSearchResultLocation {
  cited_text: string;
  end_block_index: number;
  search_result_index: number;
  source: string;
  start_block_index: number;
  title: string | null;
  type: 'search_result_location';
}

export interface CitationCharLocationParam {
  cited_text: string;
  document_index: number;
  document_title: string | null;
  end_char_index: number;
  start_char_index: number;
  type: 'char_location';
}

export interface CitationPageLocationParam {
  cited_text: string;
  document_index: number;
  document_title: string | null;
  end_page_number: number;
  start_page_number: number;
  type: 'page_location';
}

export interface CitationContentBlockLocationParam {
  cited_text: string;
  document_index: number;
  document_title: string | null;
  end_block_index: number;
  start_block_index: number;
  type: 'content_block_location';
}

export interface CitationWebSearchResultLocationParam {
  cited_text: string;
  encrypted_index: string;
  title: string | null;
  type: 'web_search_result_location';
  url: string;
}

export interface CitationSearchResultLocationParam {
  cited_text: string;
  end_block_index: number;
  search_result_index: number;
  source: string;
  start_block_index: number;
  title: string | null;
  type: 'search_result_location';
}

export interface CitationsConfigParam {
  enabled?: boolean;
}

//
// Source Types (for images, documents, etc.)
//

export interface Base64ImageSource {
  data: string;
  media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  type: 'base64';
}

export interface URLImageSource {
  type: 'url';
  url: string;
}

export interface Base64PDFSource {
  data: string;
  media_type: 'application/pdf';
  type: 'base64';
}

export interface URLPDFSource {
  type: 'url';
  url: string;
}

export interface PlainTextSource {
  data: string;
  media_type: 'text/plain';
  type: 'text';
}

export interface ContentBlockSource {
  content: string | Array<ContentBlockSourceContent>;
  type: 'content';
}

export type ContentBlockSourceContent = TextBlockParam | ImageBlockParam;

//
// Tool & Tool-Related Types
//

export interface Tool {
  input_schema: Tool.InputSchema;
  name: string;
  cache_control?: CacheControlEphemeral | null;
  description?: string;
  type?: 'custom' | null;
}

export namespace Tool {
  export interface InputSchema {
    type: 'object';
    properties?: unknown | null;
    required?: Array<string> | null;
    [k: string]: unknown;
  }
}

export type ToolChoice = ToolChoiceAuto | ToolChoiceAny | ToolChoiceTool | ToolChoiceNone;

export interface ToolChoiceAuto {
  type: 'auto';
  disable_parallel_tool_use?: boolean;
}

export interface ToolChoiceAny {
  type: 'any';
  disable_parallel_tool_use?: boolean;
}

export interface ToolChoiceTool {
  name: string;
  type: 'tool';
  disable_parallel_tool_use?: boolean;
}

export interface ToolChoiceNone {
  type: 'none';
}

export type WebSearchToolResultBlockContent = WebSearchToolResultError | Array<WebSearchResultBlock>;

export type WebSearchToolResultBlockParamContent =
  | Array<WebSearchResultBlockParam>
  | WebSearchToolRequestError;

export interface WebSearchToolResultError {
  error_code:
    | 'invalid_tool_input'
    | 'unavailable'
    | 'max_uses_exceeded'
    | 'too_many_requests'
    | 'query_too_long';
  type: 'web_search_tool_result_error';
}

export interface WebSearchResultBlock {
  encrypted_content: string;
  page_age: string | null;
  title: string;
  type: 'web_search_result';
  url: string;
}

export interface WebSearchResultBlockParam {
  encrypted_content: string;
  title: string;
  type: 'web_search_result';
  url: string;
  page_age?: string | null;
}

export interface WebSearchToolRequestError {
  error_code:
    | 'invalid_tool_input'
    | 'unavailable'
    | 'max_uses_exceeded'
    | 'too_many_requests'
    | 'query_too_long';
  type: 'web_search_tool_result_error';
}

//
// Miscellaneous Supporting Types
//

export interface CacheControlEphemeral {
  type: 'ephemeral';
  ttl?: '5m' | '1h';
}