import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { apiClient } from '@/api/client';
import type { CreateSessionRequest } from '@pokecode/api';
import type { Repository } from './useRepositories';

interface CreateSessionParams {
  repository: Repository;
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
      const { repository } = params;

      // Create session using projectPath and provider (hardcoded to 'claude-code')
      const payload: CreateSessionRequest = {
        projectPath: repository.path,
        provider: 'claude-code',
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
