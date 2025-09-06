import { useQuery } from '@tanstack/react-query';
import { apiClient, type GitDiffQuery, type GitDiffResponse } from '@/api/client';

export function useGitDiff(params: { sessionId: string; query: GitDiffQuery; enabled?: boolean }) {
  const { sessionId, query, enabled } = params;
  return useQuery<GitDiffResponse, Error>({
    queryKey: ['git-diff', sessionId, query],
    queryFn: () => apiClient.getGitDiff({ sessionId, query }),
    enabled: (enabled ?? true) && sessionId.length > 0 && query.path.length > 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}
