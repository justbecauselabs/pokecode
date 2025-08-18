import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { type RepositoryResponse } from '@pokecode/api';

// Add compatibility fields for existing code that expects different field names
export interface CompatibleRepository extends RepositoryResponse {
  name: string;
  isGitRepo: boolean;
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
      
      // Validate response structure to prevent rendering errors
      if (!response || typeof response !== 'object') {
        console.warn('Invalid response from getRepositories:', response);
        return { repositories: [] };
      }
      
      if (!Array.isArray(response.repositories)) {
        console.warn('response.repositories is not an array:', response.repositories);
        return { repositories: [] };
      }
      
      // Transform the response to match expected format with validation
      const compatibleRepos: CompatibleRepository[] = response.repositories
        .filter(repo => repo && typeof repo === 'object' && repo.folderName && repo.path)
        .map(repo => ({
          ...repo,
          name: repo.folderName, // Map folderName to name for compatibility
          isGitRepo: repo.isGitRepository, // Map isGitRepository to isGitRepo for compatibility
        }));
        
      return { repositories: compatibleRepos };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });
}
