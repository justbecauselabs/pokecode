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
  const queryClient = useQueryClient();
  const connectRef = useRef<() => void>(() => {});
  const DEBUG_SSE = __DEV__;

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let isActive = true;
    if (DEBUG_SSE) {
      console.log('[SSE] Effect start', { sessionId });
    }

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
        eventSourceRef.current = null;
      }

      const baseUrl = apiClient.getCurrentBaseUrl();
      const sseUrl = `${baseUrl}/api/sessions/${sessionId}/messages/stream`;

      if (DEBUG_SSE) {
        console.log('[SSE] Connecting to:', sseUrl);
      }

      const eventSource = new EventSource(sseUrl, {
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });

      eventSourceRef.current = eventSource;
      // expose reconnect for external calls
      connectRef.current = connectSSE;

      eventSource.addEventListener('open', () => {
        if (!isActive) {
          return;
        }
        if (DEBUG_SSE) {
          console.log('[SSE] Connection opened for session:', sessionId);
        }
        setIsConnected(true);
        setError(null);
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
            if (DEBUG_SSE) {
              console.log('[SSE] Received heartbeat for session:', sessionId);
            }
          }
        } catch (err) {
          if (DEBUG_SSE) {
            console.error('[SSE] Failed to parse SSE event:', err, event.data);
          }
        }
      });

      eventSource.addEventListener('error', () => {
        if (!isActive) {
          return;
        }
        // Rely on EventSource auto-retry (server sets retry: 3000)
        if (DEBUG_SSE) {
          console.warn('[SSE] Error event; EventSource will auto-retry');
        }
        setIsConnected(false);
      });

      eventSource.addEventListener('close', () => {
        if (DEBUG_SSE) {
          console.log('[SSE] Connection closed for session:', sessionId);
        }
        if (isActive) {
          setIsConnected(false);
        }
      });
    };

    // Start the connection process
    loadInitialData().then(() => {
      if (DEBUG_SSE) {
        console.log('[SSE] Loading initial data for session:', sessionId, isActive);
      }
      if (isActive) {
        connectSSE();
      }
    });

    // Cleanup function
    return () => {
      isActive = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      setIsConnected(false);
    };
  }, [sessionId, DEBUG_SSE]);

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
      // For SSE, refetch means reconnecting once
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      connectRef.current();
    },
    sendMessage: (params: { content: string }) => sendMessageMutation.mutateAsync(params),
    cancelSession: () => cancelSessionMutation.mutateAsync(),
    isSending: sendMessageMutation.isPending,
    isCancelling: cancelSessionMutation.isPending,
    isWorking,
    isConnected,
    reconnectAttempt: 0,
  };
}
