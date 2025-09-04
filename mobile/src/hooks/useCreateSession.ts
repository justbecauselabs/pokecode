import type { CreateSessionRequest } from '@pokecode/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { apiClient } from '@/api/client';
import type { Repository } from './useRepositories';

type ProviderValue = 'claude-code' | 'codex-cli';
interface CreateSessionParams {
  repository: Repository;
  provider: ProviderValue;
  context?: string;
}

/**
 * Hook to create a new session and navigate to it
 * Handles session creation API call and navigation with stack reset
 */
export function useCreateSession() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (params: CreateSessionParams) => {
      const { repository, provider } = params;

      const payload: CreateSessionRequest = {
        projectPath: repository.path,
        provider,
      };
      const response = await apiClient.createSession(payload);
      return response;
    },
    onSuccess: (response) => {
      // Invalidate sessions cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ['sessions'] });

      // Navigate to the new session with stack reset
      // This replaces the current screen (repositories) with the session screen
      // so that back navigation goes directly to home
      router.replace(`/session/${response.id}`);
    },
    onError: (error) => {
      console.error('Failed to create session:', error);
    },
  });
}
