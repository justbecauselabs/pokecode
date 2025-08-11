import { useCallback, useEffect, useRef } from "react";
import { useChatStore } from "../stores/chatStore";

interface UseSSEProps {
	sessionId: string;
	promptId: string | null;
	enabled?: boolean;
}

export function useSSE({ sessionId, promptId, enabled = true }: UseSSEProps) {
	const eventSourceRef = useRef<EventSource | null>(null);
	const retryTimeoutRef = useRef<number | null>(null);
	const retryCountRef = useRef(0);
	const { connectSSE, setConnectionStatus } = useChatStore();
	const maxRetries = 5;

	useEffect(() => {
		if (!enabled || !promptId || !sessionId) return;

		// Reset retry count when starting new connection
		retryCountRef.current = 0;

		const connect = () => {
			// Close existing connection
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
			}

			const eventSource = connectSSE(sessionId, promptId);
			if (eventSource) {
				eventSourceRef.current = eventSource;

				// Handle connection errors with retry logic
				eventSource.onerror = () => {
					if (retryCountRef.current < maxRetries) {
						const delay = Math.min(1000 * 2 ** retryCountRef.current, 10000); // Exponential backoff
						console.log(
							`SSE connection failed, retrying in ${delay}ms (attempt ${retryCountRef.current + 1}/${maxRetries})`,
						);

						retryTimeoutRef.current = setTimeout(() => {
							retryCountRef.current += 1;
							connect();
						}, delay);
					} else {
						console.error("SSE connection failed after max retries");
						setConnectionStatus(
							false,
							"Connection failed after multiple attempts",
						);
					}
				};

				// Reset retry count on successful connection
				eventSource.onopen = () => {
					retryCountRef.current = 0;
				};
			}
		};

		connect();

		return () => {
			if (retryTimeoutRef.current) {
				clearTimeout(retryTimeoutRef.current);
				retryTimeoutRef.current = null;
			}
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
				eventSourceRef.current = null;
			}
		};
	}, [sessionId, promptId, enabled]);

	const disconnect = useCallback(() => {
		if (retryTimeoutRef.current) {
			clearTimeout(retryTimeoutRef.current);
			retryTimeoutRef.current = null;
		}
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}
		setConnectionStatus(false);
	}, []);

	return { disconnect };
}
