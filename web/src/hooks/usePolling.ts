import { useCallback, useEffect, useRef } from "react";
import { useChatStore } from "../stores/chatStore";
import { apiService } from "../services/api";
import type { ChatMessage, HistoryResponse, MessagesResponse } from "../types/chat";

interface UsePollingProps {
	sessionId: string;
	promptId?: string | null; // Optional, not needed for session polling
	enabled?: boolean;
}

interface ExtendedHistoryResponse extends HistoryResponse {
	session: {
		id: string;
		isWorking: boolean;
		currentJobId?: string;
		lastJobStatus?: string;
		status: 'active' | 'inactive' | 'archived';
	};
}

export function usePolling({ sessionId, enabled = true }: UsePollingProps) {
	const intervalRef = useRef<number | null>(null);
	const retryCountRef = useRef(0);
	const storeActions = useChatStore();
	const maxRetries = 5;
	const pollInterval = 3000; // 3 seconds

	// Store the current store actions in a ref to avoid dependency issues
	const actionsRef = useRef(storeActions);
	actionsRef.current = storeActions;

	const poll = useCallback(async () => {
		if (!sessionId) return;

		const { addStreamMessage, setConnectionStatus, setWorkingState, addMessage, loadMessages } = actionsRef.current;

		try {
			const response = await apiService.get<MessagesResponse>(
				`/api/claude-code/sessions/${sessionId}/messages`
			);

			// Reset retry count on successful poll
			retryCountRef.current = 0;
			setConnectionStatus(true);

			// Use the new loadMessages method for the messages API
			await loadMessages(sessionId, response);

			// Check session working state and stop polling if not working
			if (!response.session.isWorking && intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
				setWorkingState(false);
			} else if (response.session.isWorking) {
				// Update working state if session is working
				setWorkingState(true, response.session.currentJobId);
			}

		} catch (error: unknown) {
			console.error('Polling error:', error);
			retryCountRef.current += 1;

			if (retryCountRef.current >= maxRetries) {
				console.error('Polling failed after max retries');
				actionsRef.current.setConnectionStatus(false, 'Failed to poll after multiple attempts');
				if (intervalRef.current) {
					clearInterval(intervalRef.current);
					intervalRef.current = null;
				}
			} else {
				actionsRef.current.setConnectionStatus(false, `Polling error (attempt ${retryCountRef.current}/${maxRetries})`);
			}
		}
	}, [sessionId]);

	useEffect(() => {
		if (!enabled || !sessionId) {
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
	}, [sessionId, enabled, poll]);

	const stopPolling = useCallback(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		actionsRef.current.setConnectionStatus(false);
	}, []);

	return { stopPolling };
}