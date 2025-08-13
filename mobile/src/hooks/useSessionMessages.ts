import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/rn-client';
import type { GetMessagesResponse, Message } from '../types/messages';
import { useState } from 'react';

export function useSessionMessages(sessionId: string) {
  const queryClient = useQueryClient();
  const [isWorking, setIsWorking] = useState(false);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['sessionMessages', sessionId],
    queryFn: async (): Promise<GetMessagesResponse> => {
      const response = await apiClient.getMessages({ sessionId });
      return response;
    },
    enabled: !!sessionId,
    staleTime: 0, // Always fetch fresh for real-time feel
    refetchInterval: 3000, // Poll every 3 seconds like web app
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

      // Optimistically update with user message
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
        });
      }

      setIsWorking(true);
      return { previousMessages };
    },
    onError: (_, __, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(['sessionMessages', sessionId], context.previousMessages);
      }
      setIsWorking(false);
    },
    onSuccess: () => {
      // Invalidate to get fresh data from server
      queryClient.invalidateQueries({ queryKey: ['sessionMessages', sessionId] });
    },
    onSettled: () => {
      // Stop working indicator after some delay to let polling pick up response
      setTimeout(() => {
        setIsWorking(false);
      }, 2000);
    },
  });

  const invalidateMessages = () => {
    queryClient.invalidateQueries({ queryKey: ['sessionMessages', sessionId] });
  };

  const sendMessage = (params: { content: string }) => {
    return sendMessageMutation.mutateAsync(params);
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
    isWorking,
  };
}