import { useQuery } from '@tanstack/react-query';
import type { ListCommandsResponse } from '@pokecode/api';
import { apiClient } from '@/api/client';

interface UseSlashCommandsParams {
  sessionId: string;
  type?: 'user' | 'project' | 'all';
  search?: string;
  enabled?: boolean;
}

/**
 * Hook to fetch slash commands for a session
 */
export function useSlashCommands(params: UseSlashCommandsParams) {
  const { sessionId, type = 'all', search, enabled = true } = params;

  return useQuery({
    queryKey: ['slash-commands', sessionId, type, search],
    queryFn: async (): Promise<ListCommandsResponse> => {
      return apiClient.getCommands({
        sessionId,
        query: { type, search },
      });
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - commands don't change often
    retry: 2,
  });
}

/**
 * Extract command names from the API response
 */
export function extractCommandNames(commandsData: ListCommandsResponse | undefined): string[] {
  if (!commandsData?.commands) {
    return [];
  }
  return commandsData.commands.map((cmd) => cmd.name);
}
