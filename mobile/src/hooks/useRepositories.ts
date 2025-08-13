import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/rn-client';

export interface Repository {
  folderName: string;
  path: string;
  isGitRepository: boolean;
}

export interface RepositoriesResponse {
  repositories: Repository[];
  total: number;
  githubReposDirectory: string;
}

/**
 * Hook to fetch available repositories for session creation
 * Uses React Query for caching and error handling
 */
export function useRepositories() {
  return useQuery({
    queryKey: ['repositories'],
    queryFn: async (): Promise<RepositoriesResponse> => {
      const response = await apiClient.getRepositories();
      return response;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });
}
