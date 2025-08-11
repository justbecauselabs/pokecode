import { fetchEventSource } from "@microsoft/fetch-event-source";
import { create } from "zustand";
import { apiService } from "../services/api";
import type {
	ChatMessage,
	Citation,
	HistoryResponse,
	Prompt,
	SSEMessage,
	StreamMessage,
} from "../types/chat";

interface ChatState {
	messages: ChatMessage[];
	prompts: Prompt[];
	currentPrompt: Prompt | null;
	isConnected: boolean;
	isStreaming: boolean;
	connectionError: string | null;
	isLoading: boolean;
	error: string | null;
	streamMessages: Map<string, StreamMessage[]>;
	activeStreamingBlocks: Map<
		string,
		Map<
			number,
			{
				type: string;
				content: string;
				citations?: Citation[];
				thinking?: string;
				signature?: string;
			}
		>
	>;
	streamingSidebarPromptId: string | null;
	intermediateMessages: Map<string, ChatMessage[]>;
	loadingIntermediateMessages: Set<string>;

	// Actions
	sendMessage: (sessionId: string, content: string) => Promise<string>;
	connectSSE: (sessionId: string, promptId: string) => EventSource | null;
	addMessage: (message: ChatMessage) => void;
	updateStreamingMessage: (content: string, complete?: boolean) => void;
	addStreamMessage: (promptId: string, streamMessage: StreamMessage) => void;
	loadPromptHistory: (sessionId: string) => Promise<void>;
	loadIntermediateMessages: (sessionId: string, threadId: string) => Promise<void>;
	setConnectionStatus: (connected: boolean, error?: string) => void;
	setStreamingSidebarPromptId: (promptId: string | null) => void;
	clearMessages: () => void;
	clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
	messages: [],
	prompts: [],
	currentPrompt: null,
	isConnected: false,
	isStreaming: false,
	connectionError: null,
	isLoading: false,
	error: null,
	streamMessages: new Map(),
	activeStreamingBlocks: new Map(),
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

			set((state) => ({
				prompts: [...state.prompts, prompt],
				currentPrompt: prompt,
				isLoading: false,
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

	connectSSE: (sessionId: string, promptId: string) => {
		const {
			setConnectionStatus,
			updateStreamingMessage,
			addMessage,
			addStreamMessage,
		} = get();

		try {
			// Use proxy-aware URL for Vite development
			const url = `/api/claude-code/sessions/${sessionId}/prompts/${promptId}/stream`;

			let assistantMessage: ChatMessage | null = null;
			let controller: AbortController | null = new AbortController();
			let streamMessageCounter = 0;

			// Use fetch-based EventSource
			fetchEventSource(url, {
				method: "GET",
				headers: {
					Accept: "text/event-stream",
					"Cache-Control": "no-cache",
				},
				signal: controller.signal,

				async onopen(response) {
					if (response.ok) {
						setConnectionStatus(true);
						set({ isStreaming: true });
						console.log("SSE connected successfully");
					} else if (
						response.status >= 400 &&
						response.status < 500 &&
						response.status !== 429
					) {
						// Client error, don't retry
						const errorMessage = `Client error: ${response.status}`;
						setConnectionStatus(false, errorMessage);
						throw new Error(`HTTP ${response.status}`);
					} else {
						// Server error, will retry
						setConnectionStatus(false, `Server error: ${response.status}`);
						throw new Error(`HTTP ${response.status}`);
					}
				},

				onmessage(event) {
					try {
						// Validate event data exists and is not empty
						if (!event.data || event.data.trim() === "") {
							console.warn("Received empty SSE message, skipping...");
							return;
						}

						let data: SSEMessage & {
							content?: string;
							tool?: string;
							params?: unknown;
							result?: unknown;
						};
						try {
							data = JSON.parse(event.data);
						} catch (parseError) {
							console.error("Failed to parse SSE message:", {
								error: parseError,
								rawData: event.data,
								dataLength: event.data.length,
								dataPreview: event.data.substring(0, 100),
							});
							return;
						}

						// Validate required message properties
						if (!data || typeof data.type !== "string") {
							console.warn("Invalid SSE message format:", data);
							return;
						}

						// Add all stream messages to the store
						// Handle different SSE data formats - some have nested data, others have content directly
						let messageData = data.data;
						if (!messageData && data.content) {
							// For messages like {"type":"message","content":"...","timestamp":"..."}
							messageData = { content: data.content };
						} else if (!messageData && data.tool) {
							// For tool messages like {"type":"tool_use","tool":"LS","params":{...}}
							messageData = { tool: data.tool, params: data.params };
						} else if (!messageData && data.result) {
							// For tool results like {"type":"tool_result","result":"..."}
							messageData = { result: data.result };
						} else if (!messageData) {
							// Store the entire data object as fallback
							messageData = data;
						}

						const streamMessage: StreamMessage = {
							id: `stream-${promptId}-${streamMessageCounter++}`,
							type: data.type,
							data: messageData,
							timestamp: data.timestamp || new Date().toISOString(),
							promptId,
						};
						addStreamMessage(promptId, streamMessage);

						switch (data.type) {
							case "connected":
								console.log("SSE connected:", data.data);
								break;

							case "message_start":
								// Initialize assistant message for streaming
								if (!assistantMessage) {
									assistantMessage = {
										id: `assistant-${promptId}`,
										role: "assistant",
										content: "",
										timestamp: new Date(),
										isStreaming: true,
										promptId,
									};
									addMessage(assistantMessage);
								}
								// Initialize streaming blocks for this prompt
								set((state) => {
									const newActiveBlocks = new Map(state.activeStreamingBlocks);
									newActiveBlocks.set(promptId, new Map());
									return { activeStreamingBlocks: newActiveBlocks };
								});
								break;

							case "content_block_start": {
								const startData = data.data as {
									index: number;
									contentBlock: any;
								};
								if (startData) {
									set((state) => {
										const newActiveBlocks = new Map(
											state.activeStreamingBlocks,
										);
										const promptBlocks =
											newActiveBlocks.get(promptId) || new Map();
										promptBlocks.set(startData.index, {
											type: startData.contentBlock.type,
											content: "",
											citations: startData.contentBlock.citations,
											thinking:
												startData.contentBlock.type === "thinking"
													? ""
													: undefined,
											signature: startData.contentBlock.signature,
										});
										newActiveBlocks.set(promptId, promptBlocks);
										return { activeStreamingBlocks: newActiveBlocks };
									});
								}
								break;
							}

							case "text_delta": {
								const textDeltaData = data.data as {
									index: number;
									text: string;
								};
								if (textDeltaData && assistantMessage) {
									// Update the streaming block
									set((state) => {
										const newActiveBlocks = new Map(
											state.activeStreamingBlocks,
										);
										const promptBlocks = newActiveBlocks.get(promptId);
										if (promptBlocks) {
											const block = promptBlocks.get(textDeltaData.index);
											if (block && block.type === "text") {
												block.content += textDeltaData.text;
												// Update the main message content with text from all blocks
												const allTextContent = Array.from(promptBlocks.values())
													.filter((b) => b.type === "text")
													.map((b) => b.content)
													.join("\n\n");

												return {
													activeStreamingBlocks: newActiveBlocks,
													messages: state.messages.map((msg) =>
														msg.id === assistantMessage!.id
															? { ...msg, content: allTextContent }
															: msg,
													),
												};
											}
										}
										return { activeStreamingBlocks: newActiveBlocks };
									});
								}
								break;
							}

							case "thinking_delta": {
								const thinkingDeltaData = data.data as {
									index: number;
									thinking: string;
								};
								if (thinkingDeltaData && assistantMessage) {
									set((state) => {
										const newActiveBlocks = new Map(
											state.activeStreamingBlocks,
										);
										const promptBlocks = newActiveBlocks.get(promptId);
										if (promptBlocks) {
											const block = promptBlocks.get(thinkingDeltaData.index);
											if (block && block.thinking !== undefined) {
												block.thinking += thinkingDeltaData.thinking;
												// Update the message with thinking content
												return {
													activeStreamingBlocks: newActiveBlocks,
													messages: state.messages.map((msg) =>
														msg.id === assistantMessage!.id
															? { ...msg, thinking: block.thinking }
															: msg,
													),
												};
											}
										}
										return { activeStreamingBlocks: newActiveBlocks };
									});
								}
								break;
							}

							case "citations_delta": {
								const citationsDeltaData = data.data as {
									index: number;
									citation: Citation;
								};
								if (citationsDeltaData && assistantMessage) {
									set((state) => {
										const newActiveBlocks = new Map(
											state.activeStreamingBlocks,
										);
										const promptBlocks = newActiveBlocks.get(promptId);
										if (promptBlocks) {
											const block = promptBlocks.get(citationsDeltaData.index);
											if (block) {
												if (!block.citations) block.citations = [];
												block.citations.push(citationsDeltaData.citation);
												// Update the message with citations
												const allCitations = Array.from(
													promptBlocks.values(),
												).flatMap((b) => b.citations || []);

												return {
													activeStreamingBlocks: newActiveBlocks,
													messages: state.messages.map((msg) =>
														msg.id === assistantMessage!.id
															? { ...msg, citations: allCitations }
															: msg,
													),
												};
											}
										}
										return { activeStreamingBlocks: newActiveBlocks };
									});
								}
								break;
							}

							case "content_block_stop": {
								const stopData = data.data as { index: number };
								if (stopData) {
									// Block is complete, finalize content
									set((state) => {
										const promptBlocks =
											state.activeStreamingBlocks.get(promptId);
										if (promptBlocks) {
											const block = promptBlocks.get(stopData.index);
											if (block && assistantMessage) {
												// Finalize the content for this block
												const allTextContent = Array.from(promptBlocks.values())
													.filter((b) => b.type === "text")
													.map((b) => b.content)
													.join("\n\n");
												const allThinking = Array.from(
													promptBlocks.values(),
												).find((b) => b.type === "thinking")?.thinking;
												const allCitations = Array.from(
													promptBlocks.values(),
												).flatMap((b) => b.citations || []);

												return {
													messages: state.messages.map((msg) =>
														msg.id === assistantMessage!.id
															? {
																	...msg,
																	content: allTextContent,
																	thinking: allThinking,
																	citations:
																		allCitations.length > 0
																			? allCitations
																			: undefined,
																}
															: msg,
													),
												};
											}
										}
										return state;
									});
								}
								break;
							}

							case "message_stop":
								// Finalize the message
								set((state) => {
									const newActiveBlocks = new Map(state.activeStreamingBlocks);
									newActiveBlocks.delete(promptId);
									return {
										activeStreamingBlocks: newActiveBlocks,
										messages: state.messages.map((msg) =>
											msg.id === assistantMessage?.id
												? { ...msg, isStreaming: false }
												: msg,
										),
										isStreaming: false,
									};
								});
								controller?.abort();
								controller = null;
								break;

							// Legacy message handling for compatibility
							case "message":
								if (!assistantMessage) {
									assistantMessage = {
										id: `assistant-${promptId}`,
										role: "assistant",
										content: String(data.data || ""),
										timestamp: new Date(),
										isStreaming: true,
										promptId,
									};
									addMessage(assistantMessage);
								} else {
									updateStreamingMessage(String(data.data || ""));
								}
								break;

							case "thinking": {
								const thinkingData = data.data as {
									thinking: string;
									signature?: string;
								};
								if (thinkingData && assistantMessage) {
									set((state) => ({
										messages: state.messages.map((msg) =>
											msg.id === assistantMessage!.id
												? {
														...msg,
														thinking: thinkingData.thinking,
														signature: thinkingData.signature,
													}
												: msg,
										),
									}));
								}
								break;
							}

							case "tool_use":
							case "server_tool_use":
							case "tool_result":
							case "web_search_result":
								// These are handled in the stream sidebar
								break;

							case "complete":
								// Refetch the message to get the final response
								apiService
									.get<HistoryResponse>(
										`/api/claude-code/sessions/${sessionId}/history`,
									)
									.then((historyResponse) => {
										const prompt = historyResponse.prompts.find(
											(p) => p.id === promptId,
										);
										if (prompt?.response && assistantMessage) {
											// Update the assistant message with the final response
											set((state) => ({
												messages: state.messages.map((msg) =>
													msg.id === assistantMessage!.id
														? {
																...msg,
																content: prompt.response!,
																isStreaming: false,
																thinking: prompt.metadata?.thinking,
																citations: prompt.metadata?.citations,
															}
														: msg,
												),
											}));
										}
									})
									.catch(console.error);

								set({ isStreaming: false });
								controller?.abort();
								controller = null;
								break;

							case "error": {
								console.error("SSE error:", data.data);
								const errorData = data.data as
									| { error?: string; error_code?: string }
									| string
									| undefined;
								const errorMessage =
									typeof errorData === "object" && errorData?.error
										? errorData.error
										: typeof errorData === "string"
											? errorData
											: "Unknown error";
								setConnectionStatus(false, errorMessage);
								set({ isStreaming: false });
								controller?.abort();
								controller = null;
								break;
							}
						}
					} catch (error) {
						console.error("Error processing SSE message:", {
							error,
							eventData: event?.data,
							promptId,
							messageCounter: streamMessageCounter,
						});

						// Emit error event for debugging
						setConnectionStatus(
							false,
							`Message processing error: ${error instanceof Error ? error.message : "Unknown error"}`,
						);
					}
				},

				onerror(error) {
					console.error("SSE connection error:", error);
					setConnectionStatus(false, "Connection error");
					set({ isStreaming: false });
					// fetchEventSource will handle retries automatically
				},

				onclose() {
					console.log("SSE connection closed");
					set({ isStreaming: false });
					controller = null;
				},
			});

			// Return a mock EventSource-like object for compatibility
			return {
				close: () => {
					controller?.abort();
					controller = null;
				},
			} as EventSource;
		} catch (error) {
			console.error("Failed to connect SSE:", error);
			setConnectionStatus(false, "Failed to connect");
			return null;
		}
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

	updateStreamingMessage: (content: string, complete = false) => {
		set((state) => ({
			messages: state.messages.map((msg) =>
				msg.isStreaming
					? {
							...msg,
							content: complete ? msg.content : content,
							isStreaming: !complete,
						}
					: msg,
			),
		}));
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
