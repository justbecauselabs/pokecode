import type { ListAgentsQuery, ListAgentsResponse } from '@pokecode/api';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

/**
 * Hook to fetch available agents for a session
 */
export function useAgents(params: { sessionId: string; query?: ListAgentsQuery }) {
  const { sessionId, query } = params;

  return useQuery({
    queryKey: ['agents', sessionId, query],
    queryFn: (): Promise<ListAgentsResponse> => {
      return apiClient.getAgents({ sessionId, query });
    },
    enabled: !!sessionId,
    staleTime: 10 * 60 * 1000, // 10 minutes - agents don't change frequently
    gcTime: 15 * 60 * 1000, // 15 minutes cache time
    refetchOnMount: false, // Don't refetch on mount if data is fresh
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
}
