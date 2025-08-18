import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { apiClient } from '../api/client';
import type { GetMessagesResponse, Message } from '../types/messages';

export function useSessionMessages(sessionId: string) {
  const queryClient = useQueryClient();
  const retryCountRef = useRef(0);
  const maxRetries = 5;
  const lastPollingStateRef = useRef<'working' | 'finished' | 'no-session' | null>(null);
  const isSendingRef = useRef(false); // Track if we're sending a message

  // Conditional polling function - improved to handle race conditions
  const getRefetchInterval = useCallback((data: GetMessagesResponse | undefined) => {
    // Enhanced logging for debugging
    console.log('[Polling Debug]', {
      hasData: !!data,
      hasSession: !!data?.session,
      isWorking: data?.session?.isWorking,
      isSending: isSendingRef.current,
      lastState: lastPollingStateRef.current,
      timestamp: new Date().toISOString(),
    });

    if (!data?.session) {
      if (lastPollingStateRef.current !== 'no-session') {
        console.log('[Polling] No session data, stopping polling');
        lastPollingStateRef.current = 'no-session';
      }
      return false;
    }

    // If we're sending a message or Claude is working, continue polling
    if (data.session.isWorking || isSendingRef.current) {
      if (lastPollingStateRef.current !== 'working') {
        console.log('[Polling] Claude is working or sending message, continuing polling every 3s');
        lastPollingStateRef.current = 'working';
      }
      retryCountRef.current = 0; // Reset retry count on successful poll
      return 3000;
    }

    // Only stop polling if we're certain Claude is finished AND we're not sending
    if (!isSendingRef.current && !data.session.isWorking) {
      if (lastPollingStateRef.current !== 'finished') {
        console.log('[Polling] Claude finished working and not sending, stopping polling');
        lastPollingStateRef.current = 'finished';
      }
      return false;
    }

    // Default: continue polling if uncertain
    console.log('[Polling] Uncertain state, continuing polling as fallback');
    return 3000;
  }, []);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sessionMessages', sessionId],
    queryFn: async (): Promise<GetMessagesResponse> => {
      console.log('[API] Fetching messages for session:', sessionId);
      try {
        const response = await apiClient.getMessages({ sessionId });
        retryCountRef.current = 0; // Reset retry count on success
        console.log('[API] Messages fetched successfully, isWorking:', response.session?.isWorking);
        return response;
      } catch (error) {
        retryCountRef.current += 1;
        console.error(
          '[API] Message fetch failed, attempt',
          retryCountRef.current,
          'of',
          maxRetries
        );
        if (retryCountRef.current >= maxRetries) {
          console.error('Message polling failed after max retries');
          throw error;
        }
        throw error;
      }
    },
    enabled: !!sessionId,
    staleTime: 0, // Always fetch fresh for real-time feel
    gcTime: 0, // Don't keep stale data in cache
    refetchOnMount: true, // Always refetch on mount
    refetchOnWindowFocus: true, // Refetch when app regains focus
    refetchInterval: (query) => getRefetchInterval(query.state.data), // Conditional polling
    refetchIntervalInBackground: true, // Continue polling in background
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (params: { content: string }) => {
      return apiClient.sendMessage({
        sessionId,
        data: { content: params.content },
      });
    },
    onMutate: async (params) => {
      // Set sending state to prevent premature polling termination
      isSendingRef.current = true;
      console.log('[Mutation] Starting message send, setting isSending=true');

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['sessionMessages', sessionId] });

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<GetMessagesResponse>([
        'sessionMessages',
        sessionId,
      ]);

      // Optimistically update with user message and working state
      if (previousMessages) {
        const optimisticUserMessage: Message = {
          id: `temp-${Date.now()}`,
          type: 'user',
          data: {
            content: params.content,
          },
          parentToolUseId: null,
        };

        queryClient.setQueryData<GetMessagesResponse>(['sessionMessages', sessionId], {
          ...previousMessages,
          messages: [...previousMessages.messages, optimisticUserMessage],
          session: {
            ...previousMessages.session,
            isWorking: true, // Optimistically set working state
          },
        });
      }

      return { previousMessages };
    },
    onError: (_, __, context) => {
      // Clear sending state and rollback on error
      isSendingRef.current = false;
      console.log('[Mutation] Message send failed, setting isSending=false');

      if (context?.previousMessages) {
        queryClient.setQueryData(['sessionMessages', sessionId], context.previousMessages);
      }
    },
    onSuccess: () => {
      // Clear sending state but keep polling until server confirms work is done
      isSendingRef.current = false;
      console.log(
        '[Mutation] Message sent successfully, setting isSending=false and invalidating query'
      );

      // Invalidate to get fresh data from server, polling will continue based on isWorking
      queryClient.invalidateQueries({ queryKey: ['sessionMessages', sessionId] });
    },
  });

  const invalidateMessages = () => {
    queryClient.invalidateQueries({ queryKey: ['sessionMessages', sessionId] });
  };

  const sendMessage = async (params: { content: string }) => {
    const result = await sendMessageMutation.mutateAsync(params);

    // No need to call refetch() here - onSuccess already invalidates the query
    // which triggers a refetch and starts the polling cycle

    return result;
  };

  return {
    messages: data?.messages || [],
    session: data?.session,
    isLoading,
    error,
    refetch,
    invalidateMessages,
    sendMessage,
    isSending: sendMessageMutation.isPending,
    isWorking: data?.session?.isWorking || false, // Use server state
  };
}
