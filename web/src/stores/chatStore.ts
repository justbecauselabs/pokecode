import { create } from "zustand";
import { apiService } from "../services/api";
import type {
	ChatMessage,
	HistoryResponse,
	Prompt,
	StreamMessage,
} from "../types/chat";

interface ChatState {
	messages: ChatMessage[];
	prompts: Prompt[];
	currentPrompt: Prompt | null;
	isConnected: boolean;
	isWorking: boolean; // Replaces isStreaming for "Claude is working" state
	connectionError: string | null;
	isLoading: boolean;
	error: string | null;
	streamMessages: Map<string, StreamMessage[]>;
	workingPromptId: string | null; // Track which prompt is currently being processed
	streamingSidebarPromptId: string | null;
	intermediateMessages: Map<string, ChatMessage[]>;
	loadingIntermediateMessages: Set<string>;

	// Actions
	sendMessage: (sessionId: string, content: string) => Promise<string>;
	addMessage: (message: ChatMessage) => void;
	addStreamMessage: (promptId: string, streamMessage: StreamMessage) => void;
	loadPromptHistory: (sessionId: string) => Promise<void>;
	loadIntermediateMessages: (sessionId: string, threadId: string) => Promise<void>;
	setConnectionStatus: (connected: boolean, error?: string) => void;
	setStreamingSidebarPromptId: (promptId: string | null) => void;
	setWorkingState: (isWorking: boolean, promptId?: string | null) => void;
	clearMessages: () => void;
	clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
	messages: [],
	prompts: [],
	currentPrompt: null,
	isConnected: false,
	isWorking: false,
	connectionError: null,
	isLoading: false,
	error: null,
	streamMessages: new Map(),
	workingPromptId: null,
	streamingSidebarPromptId: null,
	intermediateMessages: new Map(),
	loadingIntermediateMessages: new Set(),

	sendMessage: async (sessionId: string, content: string) => {
		set({ isLoading: true, error: null });

		try {
			// Add user message immediately
			const userMessage: ChatMessage = {
				id: `user-${Date.now()}`,
				role: "user",
				content,
				timestamp: new Date(),
			};

			get().addMessage(userMessage);

			// Create prompt on backend
			const prompt = await apiService.post<Prompt>(
				`/api/claude-code/sessions/${sessionId}/prompts`,
				{ prompt: content },
			);

			// Add "Claude is working" message
			const workingMessage: ChatMessage = {
				id: `working-${prompt.id}`,
				role: "assistant",
				content: "Claude is working...",
				timestamp: new Date(),
				isWorking: true,
				promptId: prompt.id,
			};

			set((state) => ({
				prompts: [...state.prompts, prompt],
				currentPrompt: prompt,
				messages: [...state.messages, workingMessage],
				isLoading: false,
				isWorking: true,
				workingPromptId: prompt.id,
				// Automatically set the new prompt as the streaming sidebar target
				streamingSidebarPromptId: prompt.id,
			}));

			return prompt.id;
		} catch (error: any) {
			set({
				error: error.response?.data?.message || "Failed to send message",
				isLoading: false,
			});
			throw error;
		}
	},

	setWorkingState: (isWorking: boolean, promptId?: string | null) => {
		set((state) => {
			// If stopping work, remove the working message and update state
			if (!isWorking && state.workingPromptId) {
				const filteredMessages = state.messages.filter(
					msg => !msg.isWorking || msg.promptId !== state.workingPromptId
				);
				return {
					isWorking: false,
					workingPromptId: null,
					messages: filteredMessages,
				};
			}

			// If starting work, set the working state
			return {
				isWorking,
				workingPromptId: promptId || state.workingPromptId,
			};
		});
	},

	addMessage: (message: ChatMessage) => {
		set((state) => ({
			messages: [...state.messages, message],
		}));
	},

	addStreamMessage: (promptId: string, streamMessage: StreamMessage) => {
		set((state) => {
			const currentMessages = state.streamMessages.get(promptId) || [];
			const newStreamMessages = new Map(state.streamMessages);
			newStreamMessages.set(promptId, [...currentMessages, streamMessage]);
			return { streamMessages: newStreamMessages };
		});
	},


	loadPromptHistory: async (sessionId: string) => {
		set({ isLoading: true, error: null });

		try {
			const historyResponse = await apiService.get<HistoryResponse>(
				`/api/claude-code/sessions/${sessionId}/history`,
			);

			// Extract prompts array from the response object
			const { prompts } = historyResponse;

			// Convert prompts to messages with thread information
			const messages: ChatMessage[] = [];

			// Group prompts by thread since backend now returns user prompts and final responses separately
			const promptsArray = prompts.reverse();

			promptsArray.forEach((prompt) => {
				// Check if this is a user prompt or final response based on metadata
				if (prompt.metadata?.role === 'user') {
					// User message
					messages.push({
						id: prompt.id,
						role: "user",
						content: prompt.prompt,
						timestamp: new Date(prompt.createdAt),
						metadata: {
							...prompt.metadata,
							hasIntermediateMessages: prompt.metadata.hasIntermediateMessages,
							threadId: prompt.metadata.threadId
						},
					});
				} else if (prompt.metadata?.role === 'assistant') {
					// Final response from assistant
					messages.push({
						id: prompt.id,
						role: "assistant",
						content: prompt.prompt,
						timestamp: new Date(prompt.createdAt),
						metadata: {
							...prompt.metadata,
							isThreadFinalResponse: prompt.metadata.isThreadFinalResponse,
							threadId: prompt.metadata.threadId
						},
					});
				}
			});

			set({
				prompts,
				messages,
				isLoading: false,
			});
		} catch (error: any) {
			set({
				error: error.response?.data?.message || "Failed to load history",
				isLoading: false,
			});
		}
	},

	setConnectionStatus: (connected: boolean, error?: string) => {
		set({
			isConnected: connected,
			connectionError: error || null,
		});
	},

	setStreamingSidebarPromptId: (promptId: string | null) => {
		set({ streamingSidebarPromptId: promptId });
	},

	clearMessages: () => {
		set({
			messages: [],
			prompts: [],
			currentPrompt: null,
			streamMessages: new Map(),
			activeStreamingBlocks: new Map(),
			streamingSidebarPromptId: null,
		});
	},

	clearError: () => set({ error: null }),

	loadIntermediateMessages: async (sessionId: string, threadId: string) => {
		// Check if already loading
		const { loadingIntermediateMessages } = get();
		if (loadingIntermediateMessages.has(threadId)) {
			return;
		}

		// Add to loading set
		set((state) => ({
			loadingIntermediateMessages: new Set([...state.loadingIntermediateMessages, threadId])
		}));

		try {
			const response = await apiService.get<{ messages: ChatMessage[]; count: number }>(
				`/api/claude-code/sessions/${sessionId}/threads/${threadId}/intermediate`
			);

			// Convert response messages to ChatMessage format
			const intermediateMessages: ChatMessage[] = response.messages.map((msg: any) => ({
				id: msg.id,
				role: msg.metadata?.role === 'user' ? 'user' : 'assistant',
				content: msg.prompt || '',
				timestamp: new Date(msg.createdAt),
				metadata: {
					...msg.metadata,
					isIntermediate: true,
				},
			}));

			// Update store with intermediate messages
			set((state) => {
				const newIntermediateMessages = new Map(state.intermediateMessages);
				newIntermediateMessages.set(threadId, intermediateMessages);
				const newLoadingSet = new Set(state.loadingIntermediateMessages);
				newLoadingSet.delete(threadId);

				return {
					intermediateMessages: newIntermediateMessages,
					loadingIntermediateMessages: newLoadingSet,
				};
			});
		} catch (error: any) {
			console.error('Failed to load intermediate messages:', error);
			
			// Remove from loading set on error
			set((state) => {
				const newLoadingSet = new Set(state.loadingIntermediateMessages);
				newLoadingSet.delete(threadId);
				return {
					loadingIntermediateMessages: newLoadingSet,
					error: error.response?.data?.message || 'Failed to load intermediate messages',
				};
			});
		}
	},
}));
