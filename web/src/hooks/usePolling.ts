import { useCallback, useEffect, useRef } from "react";
import { useChatStore } from "../stores/chatStore";
import { apiService } from "../services/api";
import type { GetMessagesResponse } from "../types/api";

interface UsePollingProps {
	sessionId: string;
	promptId?: string | null; // Optional, not needed for session polling
	enabled?: boolean;
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

		const { setConnectionStatus, setWorkingState, loadMessages } = actionsRef.current;

		try {
			const response = await apiService.get<GetMessagesResponse>(
				`/api/claude-code/sessions/${sessionId}/messages`
			);

			// Reset retry count on successful poll
			retryCountRef.current = 0;
			setConnectionStatus(true);

			// Use the new loadMessages method for the messages API
			await loadMessages(sessionId, response);

			// Use the session's isWorking field to determine if we should continue polling
			const stillWorking = response.session.isWorking;
			
			// Continue or stop polling based on session working state
			if (!stillWorking && intervalRef.current) {
				// Claude has finished working, stop polling
				clearInterval(intervalRef.current);
				intervalRef.current = null;
				setWorkingState(false);
			} else if (stillWorking) {
				// Keep polling - Claude is still working
				setWorkingState(true, response.session.currentJobId || undefined);
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