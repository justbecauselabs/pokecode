import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import type { GetMessagesResponse, Message } from '../types/messages';

export function useSessionMessages(sessionId: string) {
  const queryClient = useQueryClient();
  const lastCursorRef = useRef<string | null>(null);
  const allMessagesRef = useRef<Message[]>([]);
  const isInitialLoadRef = useRef(true);

  // Reset cache when sessionId changes
  useEffect(() => {
    console.log('[Cache] Resetting message cache for session:', sessionId);
    lastCursorRef.current = null;
    allMessagesRef.current = [];
    isInitialLoadRef.current = true;
  }, [sessionId]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sessionMessages', sessionId],
    queryFn: async (): Promise<GetMessagesResponse> => {
      try {
        let response: GetMessagesResponse;

        if (isInitialLoadRef.current) {
          // Initial load: fetch ALL messages
          console.log('[API] Initial load - fetching all messages for session:', sessionId);
          response = await apiClient.getMessages({
            sessionId,
            query: { limit: 1000 } // Fetch all messages
          });
          allMessagesRef.current = response.messages;
          lastCursorRef.current = response.pagination?.nextCursor || null;
          isInitialLoadRef.current = false;

          console.log('[API] Initial load complete, total messages:', response.messages.length);
        } else {
          // Incremental load: fetch only new messages since cursor
          if (lastCursorRef.current) {
            console.log('[API] Incremental fetch from cursor:', lastCursorRef.current);
            response = await apiClient.getMessages({
              sessionId,
              query: { after: lastCursorRef.current, limit: 50 },
            });

            // Append new messages to existing ones
            if (response.messages.length > 0) {
              allMessagesRef.current = [...allMessagesRef.current, ...response.messages];
              lastCursorRef.current = response.pagination?.nextCursor || null;
              console.log('[API] Added', response.messages.length, 'new messages');
            }
          } else {
            // Fallback: fetch all messages
            console.log('[API] No cursor available, fetching all messages');
            response = await apiClient.getMessages({
              sessionId,
              query: { limit: 1000 }
            });
            allMessagesRef.current = response.messages;
            lastCursorRef.current = response.pagination?.nextCursor || null;
          }

          // Return response with all accumulated messages
          response = {
            ...response,
            messages: allMessagesRef.current,
            pagination: {
              ...response.pagination,
              totalFetched: allMessagesRef.current.length,
            },
          };
        }

        return response;
      } catch (error) {
        console.error('[API] Message fetch failed:', error);
        throw error;
      }
    },
    enabled: !!sessionId,
    staleTime: 0, // Always fetch fresh
    gcTime: 0, // Don't cache
    refetchOnMount: 'always', // Always refetch on mount
    refetchOnWindowFocus: true, // Refetch when app regains focus
    refetchInterval: (query) => {
      // Poll when Claude is working
      const isWorking = query.state.data?.session?.isWorking;
      if (isWorking) {
        console.log('[Polling] Claude is working, continuing to poll');
        return 1000;
      }
      return false;
    },
    refetchIntervalInBackground: true,
  });

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

      // Get current data
      const previousMessages = queryClient.getQueryData<GetMessagesResponse>([
        'sessionMessages',
        sessionId,
      ]);

      // Optimistically add user message
      if (previousMessages) {
        const optimisticUserMessage: Message = {
          id: `temp-${Date.now()}`,
          type: 'user',
          data: { content: params.content },
          parentToolUseId: null,
        };

        // Add to local cache
        allMessagesRef.current = [...allMessagesRef.current, optimisticUserMessage];

        queryClient.setQueryData<GetMessagesResponse>(['sessionMessages', sessionId], {
          ...previousMessages,
          messages: [...previousMessages.messages, optimisticUserMessage],
          session: previousMessages.session ? {
            ...previousMessages.session,
            isWorking: true,
          } : undefined,
        });
      }

      return { previousMessages };
    },
    onError: (_, __, context) => {
      // Remove optimistic message from local cache
      if (allMessagesRef.current.length > 0) {
        const lastMessage = allMessagesRef.current[allMessagesRef.current.length - 1];
        if (lastMessage.id.startsWith('temp-')) {
          allMessagesRef.current = allMessagesRef.current.slice(0, -1);
        }
      }

      // Rollback query cache
      if (context?.previousMessages) {
        queryClient.setQueryData(['sessionMessages', sessionId], context.previousMessages);
      }
    },
    onSuccess: () => {
      // Remove optimistic message from local cache - real message will be fetched
      if (allMessagesRef.current.length > 0) {
        const lastMessage = allMessagesRef.current[allMessagesRef.current.length - 1];
        if (lastMessage.id.startsWith('temp-')) {
          allMessagesRef.current = allMessagesRef.current.slice(0, -1);
        }
      }

      // Refresh data from server
      queryClient.invalidateQueries({ queryKey: ['sessionMessages', sessionId] });
    },
  });

  const cancelSessionMutation = useMutation({
    mutationFn: async () => {
      return apiClient.cancelSession({ sessionId });
    }
  });

  return {
    messages: data?.messages || [],
    session: data?.session,
    isLoading,
    error,
    refetch,
    sendMessage: (params: { content: string }) => sendMessageMutation.mutateAsync(params),
    cancelSession: () => cancelSessionMutation.mutateAsync(),
    isSending: sendMessageMutation.isPending,
    isCancelling: cancelSessionMutation.isPending,
    isWorking: data?.session?.isWorking || false,
  };
}
