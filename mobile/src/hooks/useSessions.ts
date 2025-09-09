/**
 * React Query hook for session data fetching and management
 */

import type { CreateSessionRequest, Session } from '@pokecode/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';

export const SESSIONS_QUERY_KEY = ['sessions'] as const;

/**
 * Fetches all sessions with optional filtering
 */
export function useSessions() {
  return useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: async (): Promise<Session[]> => {
      const response = await apiClient.getSessions();
      // Server returns only sessions with lastMessageSentAt and orders by it desc.
      // Keep a defensive client-side filter and stable sort by that field only.
      return response.sessions
        .filter((s) => !!s.lastMessageSentAt)
        .slice()
        .sort((a, b) =>
          new Date(b.lastMessageSentAt || 0).getTime() - new Date(a.lastMessageSentAt || 0).getTime(),
        );
    },
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true,
  });
}

/**
 * Fetches a single session by ID
 */
export function useSession(sessionId: string) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: async (): Promise<Session> => {
      return apiClient.getSession({ sessionId });
    },
    enabled: !!sessionId,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true,
  });
}

/**
 * Creates a new session
 */
type ProviderValue = 'claude-code' | 'codex-cli';
export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { projectPath: string; provider: ProviderValue }) => {
      const payload: CreateSessionRequest = {
        projectPath: params.projectPath,
        provider: params.provider,
      };
      return apiClient.createSession(payload);
    },
    onSuccess: () => {
      // Invalidate sessions query to refetch updated list
      queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
    },
  });
}

/**
 * Deletes a session
 */
export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      return apiClient.deleteSession({ sessionId });
    },
    onSuccess: () => {
      // Invalidate sessions query to refetch updated list
      queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
    },
  });
}

/**
 * Updates a session
 */
export function useUpdateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { sessionId: string; context?: string }) => {
      return apiClient.updateSession({
        sessionId: params.sessionId,
        data: {
          context: params.context,
        },
      });
    },
    onSuccess: () => {
      // Invalidate sessions query to refetch updated list
      queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
    },
  });
}
