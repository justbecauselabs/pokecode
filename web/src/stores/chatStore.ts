import { create } from "zustand";
import { apiService } from "../services/api";
import type {
	ChatMessage,
	MessagesResponse,
	SessionMessage,
} from "../types/chat";

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
			// Add user message immediately
			const userMessage: ChatMessage = {
				id: `user-${Date.now()}`,
				role: "user",
				content,
				timestamp: new Date(),
			};

			get().addMessage(userMessage);

			// Create prompt on backend
			const response = await apiService.post<{
				success: boolean, 
				message: string, 
				jobId?: string,
				userMessage?: {
					id: string;
					sessionId: string;
					text: string;
					type: 'user';
					createdAt: string;
				}
			}>(
				`/api/claude-code/sessions/${sessionId}/prompts`,
				{ prompt: content },
			);

			// Add "Claude is working" message
			const workingMessage: ChatMessage = {
				id: `working-${response.jobId}`,
				role: "assistant",
				content: "Claude is working...",
				timestamp: new Date(),
				isWorking: true,
				promptId: response.jobId,
			};

			set((state) => ({
				messages: [...state.messages, workingMessage],
				isLoading: false,
				isWorking: true,
				workingPromptId: response.jobId,
				// Automatically set the new prompt as the streaming sidebar target
				streamingSidebarPromptId: response.jobId,
			}));

			return response.jobId || "";
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



	loadMessages: async (sessionId: string, providedResponse?: MessagesResponse) => {
		set({ isLoading: true, error: null });

		try {
			// Use provided response or fetch new one
			const messagesResponse = providedResponse || await apiService.get<MessagesResponse>(
				`/api/claude-code/sessions/${sessionId}/messages`,
			);

			// Extract messages array from the response object
			const { messages: sessionMessages } = messagesResponse;

			// Convert SessionMessage[] to ChatMessage[] for the UI
			const messages: ChatMessage[] = [];

			// Process messages in chronological order (oldest first)
			const sortedMessages = sessionMessages.sort((a, b) => 
				new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
			);

			sortedMessages.forEach((sessionMessage) => {
				// Convert SessionMessage to ChatMessage
				const chatMessage: ChatMessage = {
					id: sessionMessage.id,
					role: sessionMessage.type,
					content: sessionMessage.text,
					timestamp: new Date(sessionMessage.createdAt),
					// Add child messages
					childMessages: sessionMessage.childMessages.map(child => ({
						id: child.id,
						type: (child.type as any) || 'message',
						data: child.content,
						timestamp: child.timestamp,
						promptId: sessionMessage.id,
					})),
					metadata: {
						claudeSessionId: sessionMessage.claudeSessionId,
						hasIntermediateMessages: sessionMessage.childMessages.length > 0,
					},
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
