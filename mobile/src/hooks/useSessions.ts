/**
 * React Query hook for session data fetching and management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { GetApiClaudeCodeSessionsResponse } from '@/api/generated';

type Session = GetApiClaudeCodeSessionsResponse['sessions'][0];

export const SESSIONS_QUERY_KEY = ['sessions'] as const;

/**
 * Fetches all sessions with optional filtering
 */
export function useSessions() {
  return useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: async (): Promise<Session[]> => {
      const response = await apiClient.getSessions();
      // Extract sessions array from response and sort by lastAccessedAt descending (most recent first)
      return response.sessions.sort(
        (a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
      );
    },
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true,
  });
}

/**
 * Creates a new session
 */
export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { projectPath: string; context?: string }) => {
      return apiClient.createSession({
        projectPath: params.projectPath,
        context: params.context,
      });
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
