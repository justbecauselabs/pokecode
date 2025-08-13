/**
 * Example usage of generated OpenAPI types with React Native compatible API client
 *
 * This file demonstrates how to use the type-safe API client
 * for React Native apps with React Query integration.
 */

import { apiClient } from './rn-client';

// Generated types for TypeScript support
export type {
  // Repository types
  GetApiClaudeCodeRepositoriesResponse,
  // File types
  GetApiClaudeCodeSessionsBySessionIdFilesResponse,
  // Message types
  GetApiClaudeCodeSessionsBySessionIdMessagesResponse,
  // Session types
  GetApiClaudeCodeSessionsResponse,
  GetHealthLiveResponse,
  GetHealthReadyResponse,
  // Health types
  GetHealthResponse,
  PatchApiClaudeCodeSessionsBySessionIdData,
  PatchApiClaudeCodeSessionsBySessionIdResponse,
  PostApiClaudeCodeSessionsBySessionIdMessagesData,
  PostApiClaudeCodeSessionsBySessionIdMessagesResponse,
  PostApiClaudeCodeSessionsData,
  PostApiClaudeCodeSessionsResponse,
} from '@/api/generated';

/**
 * Example React component using React Query with our API client:
 *
 * ```tsx
 * import { useQuery } from '@tanstack/react-query';
 * import { apiClient } from '@/api/client';
 *
 * export function HealthStatus() {
 *   const { data, isLoading, error } = useQuery({
 *     queryKey: ['health'],
 *     queryFn: () => apiClient.getHealth(),
 *   });
 *
 *   if (isLoading) return <Text>Loading...</Text>;
 *   if (error) return <Text>Error: {error.message}</Text>;
 *
 *   return (
 *     <View>
 *       <Text>Status: {data?.status}</Text>
 *       <Text>Uptime: {data?.uptime}s</Text>
 *     </View>
 *   );
 * }
 * ```
 *
 * Example direct API usage:
 *
 * ```tsx
 * import { apiClient } from '@/api/client';
 *
 * export async function checkHealth() {
 *   try {
 *     const data = await apiClient.getHealth();
 *     console.log('Health status:', data.status);
 *   } catch (error) {
 *     console.error('Health check failed:', error);
 *   }
 * }
 *
 * export async function createSession() {
 *   try {
 *     const session = await apiClient.createSession({
 *       projectPath: '/path/to/project',
 *       context: 'Development session'
 *     });
 *     console.log('Created session:', session.id);
 *   } catch (error) {
 *     console.error('Session creation failed:', error);
 *   }
 * }
 * ```
 */

// Re-export the API client for convenience
export { apiClient };
