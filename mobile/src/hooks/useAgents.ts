import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/rn-client';
import type { GetAgentsQuery, GetAgentsResponse } from '../types/agents';

/**
 * Hook to fetch available agents for a session
 */
export function useAgents(params: { sessionId: string; query?: GetAgentsQuery }) {
  const { sessionId, query } = params;

  return useQuery({
    queryKey: ['agents', sessionId, query],
    queryFn: (): Promise<GetAgentsResponse> => {
      return apiClient.getAgents({ sessionId, query });
    },
    enabled: !!sessionId,
    staleTime: 10 * 60 * 1000, // 10 minutes - agents don't change frequently
    gcTime: 15 * 60 * 1000, // 15 minutes cache time
    refetchOnMount: false, // Don't refetch on mount if data is fresh
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
}