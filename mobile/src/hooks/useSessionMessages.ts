import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/rn-client';
import type { GetMessagesResponse, Message } from '../types/messages';
import { useRef, useCallback } from 'react';

export function useSessionMessages(sessionId: string) {
  const queryClient = useQueryClient();
  const retryCountRef = useRef(0);
  const maxRetries = 5;

  // Conditional polling function - matches web pattern
  const getRefetchInterval = useCallback((data: GetMessagesResponse | undefined) => {
    if (!data?.session) {
      console.log('[Polling] No session data, stopping polling');
      return false;
    }
    
    // If Claude is working, poll every 3 seconds
    if (data.session.isWorking) {
      console.log('[Polling] Claude is working, continuing polling every 3s');
      retryCountRef.current = 0; // Reset retry count on successful poll
      return 3000;
    }
    
    // If Claude finished working, stop polling
    console.log('[Polling] Claude finished working, stopping polling');
    return false;
  }, []);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['sessionMessages', sessionId],
    queryFn: async (): Promise<GetMessagesResponse> => {
      try {
        const response = await apiClient.getMessages({ sessionId });
        retryCountRef.current = 0; // Reset retry count on success
        return response;
      } catch (error) {
        retryCountRef.current += 1;
        if (retryCountRef.current >= maxRetries) {
          console.error('Message polling failed after max retries');
          throw error;
        }
        throw error;
      }
    },
    enabled: !!sessionId,
    staleTime: 0, // Always fetch fresh for real-time feel
    refetchInterval: (query) => getRefetchInterval(query.state.data), // Conditional polling
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (params: { content: string }) => {
      return apiClient.sendMessage({
        sessionId,
        data: { content: params.content }
      });
    },
    onMutate: async (params) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['sessionMessages', sessionId] });

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<GetMessagesResponse>(['sessionMessages', sessionId]);

      // Optimistically update with user message and working state
      if (previousMessages) {
        const optimisticUserMessage: Message = {
          id: `temp-${Date.now()}`,
          sessionId,
          role: 'user',
          content: params.content,
          timestamp: new Date().toISOString(),
          children: [],
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
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(['sessionMessages', sessionId], context.previousMessages);
      }
    },
    onSuccess: () => {
      // Invalidate to get fresh data from server, which will start polling
      queryClient.invalidateQueries({ queryKey: ['sessionMessages', sessionId] });
    },
  });

  const invalidateMessages = () => {
    queryClient.invalidateQueries({ queryKey: ['sessionMessages', sessionId] });
  };

  const sendMessage = async (params: { content: string }) => {
    const result = await sendMessageMutation.mutateAsync(params);
    
    // Force an immediate refetch to start polling cycle
    // This ensures polling resumes even if it had previously stopped
    refetch();
    
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