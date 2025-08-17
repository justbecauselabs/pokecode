import { useQuery } from '@tanstack/react-query';
import { apiClient, type RepositoriesResponse, type Repository } from '@/api/client';

// Add folderName for compatibility with existing code
export interface CompatibleRepository extends Repository {
  folderName: string;
  isGitRepository: boolean;
}

export type { CompatibleRepository as Repository };

/**
 * Hook to fetch available repositories for session creation
 * Uses React Query for caching and error handling
 */
export function useRepositories() {
  return useQuery({
    queryKey: ['repositories'],
    queryFn: async (): Promise<{ repositories: CompatibleRepository[] }> => {
      const response = await apiClient.getRepositories();
      // Transform the response to match expected format
      const compatibleRepos: CompatibleRepository[] = response.repositories.map(repo => ({
        ...repo,
        folderName: repo.name, // Map name to folderName for compatibility
        isGitRepository: repo.isGitRepo, // Map isGitRepo to isGitRepository
      }));
      return { repositories: compatibleRepos };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });
}
