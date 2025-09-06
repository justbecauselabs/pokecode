import { useQuery } from '@tanstack/react-query';
import { apiClient, type GitStatusQuery, type GitStatusResponse } from '@/api/client';

export function useGitStatus(params: {
  sessionId: string;
  query?: GitStatusQuery;
  enabled?: boolean;
}) {
  const { sessionId, query, enabled } = params;
  return useQuery<GitStatusResponse, Error>({
    queryKey: ['git-status', sessionId, query ?? {}],
    queryFn: () => apiClient.getGitStatus({ sessionId, query }),
    enabled: (enabled ?? true) && sessionId.length > 0,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });
}
