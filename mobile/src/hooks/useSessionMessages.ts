import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import EventSource, { type MessageEvent } from 'react-native-sse';
import 'react-native-url-polyfill/auto';
import type { SSEEvent } from '@pokecode/api';
import { SSEEventSchema } from '@pokecode/api';
import { apiClient } from '../api/client';
import type { Message, SessionInfo } from '../types/messages';

export function useSessionMessages(sessionId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let isActive = true;

    // Initial data fetch
    const loadInitialData = async () => {
      try {
        const response = await apiClient.getMessages({
          sessionId,
          query: { limit: 1000 },
        });
        if (isActive) {
          setMessages(response.messages);
          setSession(response.session);
          setIsWorking(response.session?.isWorking || false);
        }
      } catch (err) {
        console.error('[SSE] Failed to load initial messages:', err);
        if (isActive) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      }
    };

    const connectSSE = () => {
      if (!isActive) {
        return;
      }

      // Clean up existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const baseUrl = apiClient.getCurrentBaseUrl();
      const sseUrl = `${baseUrl}/api/claude-code/sessions/${sessionId}/messages/stream`;

      console.log('[SSE] Connecting to:', sseUrl);

      const eventSource = new EventSource(sseUrl, {
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });

      eventSourceRef.current = eventSource;

      eventSource.addEventListener('open', () => {
        if (!isActive) {
          return;
        }
        console.log('[SSE] Connection opened for session:', sessionId);
        setIsConnected(true);
        setError(null);
        setReconnectAttempt(0);
      });

      eventSource.addEventListener('message', (event: MessageEvent) => {
        if (!isActive) {
          return;
        }

        try {
          // Ensure event data is a string
          if (typeof event.data !== 'string') {
            console.warn('[SSE] Event data is not a string:', event.data);
            return;
          }

          // Parse and validate the SSE event
          const sseEvent: SSEEvent = SSEEventSchema.parse(JSON.parse(event.data));

          if (sseEvent.type === 'update') {
            // Handle update events with message data
            const updateData = sseEvent.data;

            // Add new message if present
            if (updateData.message) {
              const newMessage = updateData.message;
              setMessages((prev) => [...prev, newMessage]);
            }

            // Update working state
            if (updateData.state === 'running') {
              setIsWorking(true);
            } else if (updateData.state === 'done') {
              setIsWorking(false);
            }
          } else if (sseEvent.type === 'heartbeat') {
            // Handle heartbeat events (keep connection alive, no action needed)
            console.log('[SSE] Received heartbeat for session:', sessionId);
          }
        } catch (err) {
          console.error('[SSE] Failed to parse SSE event:', err, event.data);
        }
      });

      eventSource.addEventListener('error', (event: { error?: Error } | { type: string }) => {
        if (!isActive) {
          return;
        }

        console.error('[SSE] Connection error:', event);
        setIsConnected(false);

        // Attempt to reconnect with exponential backoff
        const attempt = reconnectAttempt + 1;
        const delay = Math.min(1000 * 2 ** (attempt - 1), 30000); // Max 30s

        console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${attempt})`);
        setReconnectAttempt(attempt);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (isActive && attempt <= 5) {
            // Max 5 attempts
            connectSSE();
          } else {
            setError(new Error('SSE connection failed after multiple attempts'));
          }
        }, delay);
      });

      eventSource.addEventListener('close', () => {
        console.log('[SSE] Connection closed for session:', sessionId);
        if (isActive) {
          setIsConnected(false);
        }
      });
    };

    // Start the connection process
    loadInitialData().then(() => {
      console.log('[SSE] Loading initial data for session:', sessionId, isActive);
      if (isActive) {
        connectSSE();
      }
    });

    // Cleanup function
    return () => {
      isActive = false;
      console.log('[SSE] Cleaning up connection for session:', sessionId);

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      setIsConnected(false);
    };
  }, [sessionId, reconnectAttempt]);

  const sendMessageMutation = useMutation({
    mutationFn: async (params: { content: string }) => {
      return apiClient.sendMessage({
        sessionId,
        data: { content: params.content },
      });
    },
    onMutate: async (params) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['sessionMessages', sessionId] });

      // Optimistically add user message
      const optimisticUserMessage: Message = {
        id: `temp-${Date.now()}`,
        type: 'user',
        data: { content: params.content },
        parentToolUseId: null,
      };

      setMessages((prev) => [...prev, optimisticUserMessage]);
      setIsWorking(true);

      return { optimisticUserMessage };
    },
    onError: (_, __, context) => {
      // Remove optimistic message
      if (context?.optimisticUserMessage) {
        setMessages((prev) => prev.filter((msg) => msg.id !== context.optimisticUserMessage.id));
      }
      setIsWorking(false);
    },
    onSuccess: () => {
      // Remove optimistic message - real message will come via SSE
      setMessages((prev) => prev.filter((msg) => !msg.id.startsWith('temp-')));
    },
  });

  const cancelSessionMutation = useMutation({
    mutationFn: async () => {
      return apiClient.cancelSession({ sessionId });
    },
    onSuccess: () => {
      setIsWorking(false);
    },
  });

  return {
    messages,
    session,
    isLoading: !isConnected && messages.length === 0,
    error,
    refetch: () => {
      // For SSE, refetch means reconnecting
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setReconnectAttempt((prev) => prev + 1);
    },
    sendMessage: (params: { content: string }) => sendMessageMutation.mutateAsync(params),
    cancelSession: () => cancelSessionMutation.mutateAsync(),
    isSending: sendMessageMutation.isPending,
    isCancelling: cancelSessionMutation.isPending,
    isWorking,
    isConnected,
    reconnectAttempt,
  };
}
