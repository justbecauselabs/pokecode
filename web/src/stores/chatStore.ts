import { create } from "zustand";
import { apiService } from "../services/api";
import type {
	ChatMessage,
	MessagesResponse,
	SessionMessage,
} from "../types/chat";
import type {
	ApiMessage,
	CreateMessageResponse,
	GetMessagesResponse,
} from "../types/api";

interface ChatState {
	messages: ChatMessage[];
	isConnected: boolean;
	isWorking: boolean; // Replaces isStreaming for "Claude is working" state
	connectionError: string | null;
	isLoading: boolean;
	error: string | null;
	workingPromptId: string | null; // Track which prompt is currently being processed
	streamingSidebarPromptId: string | null;

	// Actions
	sendMessage: (sessionId: string, content: string) => Promise<string>;
	addMessage: (message: ChatMessage) => void;
	loadMessages: (sessionId: string, providedResponse?: MessagesResponse) => Promise<void>;
	setConnectionStatus: (connected: boolean, error?: string) => void;
	setStreamingSidebarPromptId: (promptId: string | null) => void;
	setWorkingState: (isWorking: boolean, promptId?: string | null) => void;
	clearMessages: () => void;
	clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
	messages: [],
	isConnected: false,
	isWorking: false,
	connectionError: null,
	isLoading: false,
	error: null,
	workingPromptId: null,
	streamingSidebarPromptId: null,

	sendMessage: async (sessionId: string, content: string) => {
		set({ isLoading: true, error: null });

		try {
			// Add user message immediately with temporary ID
			const tempUserMessage: ChatMessage = {
				id: `temp-user-${Date.now()}`,
				role: "user",
				content,
				timestamp: new Date(),
			};

			get().addMessage(tempUserMessage);

			// Create message on backend using new /messages endpoint
			const response = await apiService.post<CreateMessageResponse>(
				`/api/claude-code/sessions/${sessionId}/messages`,
				{ content },
			);

			// Update the temp message with real ID from backend
			set((state) => ({
				messages: state.messages.map(msg => 
					msg.id === tempUserMessage.id 
						? { ...msg, id: response.message.id }
						: msg
				),
			}));

			// Add "Claude is working" message
			const workingMessage: ChatMessage = {
				id: `working-${response.message.id}`,
				role: "assistant",
				content: "Claude is working...",
				timestamp: new Date(),
				isWorking: true,
				promptId: response.message.id,
			};

			set((state) => ({
				messages: [...state.messages, workingMessage],
				isLoading: false,
				isWorking: true,
				workingPromptId: response.message.id,
				// Automatically set the new message as the streaming sidebar target
				streamingSidebarPromptId: response.message.id,
			}));

			return response.message.id;
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



	loadMessages: async (sessionId: string, providedResponse?: GetMessagesResponse) => {
		set({ isLoading: true, error: null });

		try {
			// Use provided response or fetch new one using new /messages endpoint
			const response = providedResponse || await apiService.get<GetMessagesResponse>(
				`/api/claude-code/sessions/${sessionId}/messages`,
			);

			// Convert ApiMessage[] to ChatMessage[] for the UI
			const messages: ChatMessage[] = [];

			// Process messages in chronological order (oldest first)
			const sortedMessages = response.messages.sort((a, b) => 
				new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
			);

			sortedMessages.forEach((apiMessage) => {
				// Convert ApiMessage to ChatMessage
				const chatMessage: ChatMessage = {
					id: apiMessage.id,
					role: apiMessage.role,
					content: apiMessage.content,
					timestamp: new Date(apiMessage.timestamp),
					// Map children to childMessages format
					childMessages: apiMessage.children.map(child => ({
						id: child.id,
						content: child.content,
						role: child.role,
						type: child.role,
						timestamp: child.timestamp,
						metadata: {
							toolCalls: child.toolCalls,
							toolResults: child.toolResults,
							thinking: child.thinking,
						},
					})),
					promptId: apiMessage.claudeSessionId,
				};

				messages.push(chatMessage);
			});

			set({
				messages,
				isLoading: false,
			});
		} catch (error: any) {
			set({
				error: error.response?.data?.message || "Failed to load messages",
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
			streamingSidebarPromptId: null,
		});
	},

	clearError: () => set({ error: null }),
}));
