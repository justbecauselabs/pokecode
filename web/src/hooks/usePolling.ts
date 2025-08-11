import { useCallback, useEffect, useRef } from "react";
import { useChatStore } from "../stores/chatStore";
import { apiService } from "../services/api";
import type { ChatMessage, HistoryResponse } from "../types/chat";

interface UsePollingProps {
	sessionId: string;
	promptId: string | null;
	enabled?: boolean;
}

interface PollResponse {
	status: 'pending' | 'running' | 'completed' | 'failed';
	messages: Array<{
		id: string;
		prompt: string;
		createdAt: string;
		metadata?: {
			type?: string;
			role?: string;
		};
	}>;
	count: number;
	isComplete: boolean;
}

export function usePolling({ sessionId, promptId, enabled = true }: UsePollingProps) {
	const intervalRef = useRef<number | null>(null);
	const retryCountRef = useRef(0);
	const { addStreamMessage, setConnectionStatus, setWorkingState, addMessage } = useChatStore();
	const maxRetries = 5;
	const pollInterval = 3000; // 3 seconds

	const poll = useCallback(async () => {
		if (!sessionId || !promptId) return;

		try {
			const response = await apiService.get<PollResponse>(
				`/api/claude-code/sessions/${sessionId}/prompts/${promptId}/poll`
			);

			// Reset retry count on successful poll
			retryCountRef.current = 0;
			setConnectionStatus(true);

			// Convert messages to stream message format for sidebar compatibility
			response.messages.forEach((message, index) => {
				const streamMessage = {
					id: `poll-${promptId}-${index}`,
					type: message.metadata?.type || 'message',
					data: {
						content: message.prompt || '',
						role: message.metadata?.role || 'assistant',
						timestamp: message.createdAt,
					},
					timestamp: message.createdAt,
					promptId,
				};
				addStreamMessage(promptId, streamMessage);
			});

			// Stop polling if complete and fetch final response
			if (response.isComplete && intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
				
				// Stop working state and remove working message
				setWorkingState(false);
				
				// Fetch final response from history
				try {
					const historyResponse = await apiService.get<HistoryResponse>(
						`/api/claude-code/sessions/${sessionId}/history`
					);
					
					const prompt = historyResponse.prompts.find(
						(p) => p.id === promptId
					);
					
					if (prompt?.response) {
						// Add final assistant message
						const finalMessage: ChatMessage = {
							id: `final-${promptId}`,
							role: "assistant",
							content: prompt.response,
							timestamp: new Date(),
							promptId,
							thinking: prompt.metadata?.thinking,
							citations: prompt.metadata?.citations,
						};
						
						addMessage(finalMessage);
					}
				} catch (error) {
					console.error('Failed to fetch final response:', error);
				}
			}

		} catch (error: unknown) {
			console.error('Polling error:', error);
			retryCountRef.current += 1;

			if (retryCountRef.current >= maxRetries) {
				console.error('Polling failed after max retries');
				setConnectionStatus(false, 'Failed to poll after multiple attempts');
				if (intervalRef.current) {
					clearInterval(intervalRef.current);
					intervalRef.current = null;
				}
			} else {
				setConnectionStatus(false, `Polling error (attempt ${retryCountRef.current}/${maxRetries})`);
			}
		}
	}, [sessionId, promptId, addStreamMessage, setConnectionStatus, setWorkingState, addMessage, maxRetries]);

	useEffect(() => {
		if (!enabled || !promptId || !sessionId) {
			return;
		}

		// Reset retry count when starting new polling
		retryCountRef.current = 0;

		// Start polling immediately, then at intervals
		poll();
		intervalRef.current = setInterval(poll, pollInterval);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [sessionId, promptId, enabled, poll]);

	const stopPolling = useCallback(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		setConnectionStatus(false);
	}, [setConnectionStatus]);

	return { stopPolling };
}