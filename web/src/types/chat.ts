// Define ChildMessage type based on SessionMessage.childMessages
export interface ChildMessage {
	id: string;
	content: string;
	role?: string;
	type?: string;
	timestamp: string;
	metadata?: any;
}

export interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: Date;
	isStreaming?: boolean;
	isWorking?: boolean;
	promptId?: string;
	childMessages?: ChildMessage[];
	citations?: Citation[];
	thinking?: string;
	signature?: string;
	toolCalls?: Array<{
		name: string;
		input: any;
	}>;
	toolResults?: Array<{
		toolUseId: string;
		content: string;
	}>;
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
	intermediateMessages?: Array<{
		id: string;
		content: string;
		role?: string;
		type?: string;
		timestamp: string;
		metadata?: any;
	}>;
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



// New message-based API types
export interface SessionMessage {
	id: string;
	sessionId: string;
	text: string;
	type: 'user' | 'assistant';
	claudeSessionId?: string;
	createdAt: string;
	childMessages: ChildMessage[];
}

export interface MessagesResponse {
	messages: SessionMessage[];
	session: {
		id: string;
		isWorking: boolean;
		currentJobId?: string;
		lastJobStatus?: string;
		status: 'active' | 'inactive' | 'archived';
	};
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
