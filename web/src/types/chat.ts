export interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: Date;
	isStreaming?: boolean;
	isWorking?: boolean;
	promptId?: string;
	streamMessages?: StreamMessage[];
	citations?: Citation[];
	thinking?: string;
	signature?: string;
}

export interface Prompt {
	id: string;
	sessionId: string;
	prompt: string;
	response?: string;
	status: "queued" | "processing" | "completed" | "failed" | "cancelled";
	jobId?: string;
	error?: string;
	metadata?: {
		toolCalls?: number;
		duration?: number;
		tokenCount?: number;
		toolCallCount?: number;
		stopReason?: StopReason;
		thinking?: string;
		citations?: Citation[];
	};
	createdAt: string;
	completedAt?: string;
}

export type StopReason =
	| "end_turn"
	| "max_tokens"
	| "stop_sequence"
	| "tool_use"
	| "pause_turn"
	| "refusal";

// Citation Types
export interface CharLocationCitation {
	type: "char_location";
	cited_text: string;
	start_char_index: number;
	end_char_index: number;
	document_index: number;
	document_title?: string;
	file_id?: string;
}

export interface PageLocationCitation {
	type: "page_location";
	cited_text: string;
	start_page_number: number;
	end_page_number: number;
	document_index: number;
	document_title?: string;
	file_id?: string;
}

export interface ContentBlockLocationCitation {
	type: "content_block_location";
	cited_text: string;
	start_block_index: number;
	end_block_index: number;
	document_index: number;
	document_title?: string;
	file_id?: string;
}

export interface SearchResultLocationCitation {
	type: "search_result_location";
	cited_text: string;
	source: string;
	start_block_index: number;
	end_block_index: number;
	search_result_index: number;
	title?: string;
}

export interface WebSearchResultLocationCitation {
	type: "web_search_result_location";
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

// Web Search Types
export interface WebSearchResult {
	type: "web_search_result";
	url: string;
	title: string;
	encrypted_content: string;
	page_age?: number;
}

export interface WebSearchToolResultError {
	type: "web_search_tool_result_error";
	error_code:
		| "invalid_tool_input"
		| "unavailable"
		| "max_uses_exceeded"
		| "too_many_requests"
		| "query_too_long";
}

export interface StreamMessage {
	id: string;
	type:
		| "connected"
		| "message"
		| "tool_use"
		| "tool_result"
		| "complete"
		| "error"
		| "message_start"
		| "content_block_start"
		| "text_delta"
		| "thinking_delta"
		| "citations_delta"
		| "content_block_delta"
		| "content_block_stop"
		| "message_delta"
		| "message_stop"
		| "thinking"
		| "server_tool_use"
		| "web_search_result"
		| "system"
		| "result";
	data?: unknown;
	timestamp: string;
	promptId: string;
	index?: number;
}

export interface SSEMessage {
	type: StreamMessage["type"];
	data?: unknown;
	timestamp?: string;
}

export interface HistoryResponse {
	prompts: Prompt[];
	total: number;
	limit: number;
	offset: number;
}

// Content rendering types
export interface ParsedMessageContent {
	text?: string;
	thinking?: string;
	signature?: string;
	citations?: Citation[];
	codeBlocks?: Array<{
		language: string;
		code: string;
	}>;
	toolUses?: Array<{
		name: string;
		input: Record<string, any>;
		id?: string;
	}>;
	webSearchResults?: WebSearchResult[];
	todos?: TodoList;
}

// TODO List types
export interface TodoItem {
	id: string;
	content: string;
	status: "pending" | "in_progress" | "completed";
}

export interface TodoList {
	todos: TodoItem[];
}
