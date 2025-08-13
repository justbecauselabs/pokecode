import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/rn-client';
import type { GetMessagesResponse } from '../types/messages';

export function useSessionMessages(sessionId: string) {
  const queryClient = useQueryClient();

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

  const invalidateMessages = () => {
    queryClient.invalidateQueries({ queryKey: ['sessionMessages', sessionId] });
  };

  return {
    messages: data?.messages || [],
    session: data?.session,
    isLoading,
    error,
    refetch,
    invalidateMessages,
  };
}