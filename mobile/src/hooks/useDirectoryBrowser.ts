import type { BrowseDirectoryResponse } from '@pokecode/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { apiClient } from '@/api/client';

interface DirectoryBrowserError {
  message: string;
  code?: string;
}

interface NavigationStackItem {
  path: string | undefined;
  data: BrowseDirectoryResponse;
}

export function useDirectoryBrowser(initialPath?: string) {
  const [navigationStack, setNavigationStack] = useState<NavigationStackItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string | undefined>(initialPath);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<
    BrowseDirectoryResponse,
    DirectoryBrowserError
  >({
    queryKey: ['directories', currentPath],
    queryFn: async () => {
      try {
        return await apiClient.browseDirectory(currentPath ? { path: currentPath } : undefined);
      } catch (err) {
        throw {
          message: err instanceof Error ? err.message : 'Failed to browse directory',
          code: 'DIRECTORY_BROWSE_ERROR',
        };
      }
    },
    staleTime: 30000, // Cache for 30 seconds
    retry: 1, // Only retry once for directory operations
  });

  const navigateToDirectory = useCallback(
    (path: string) => {
      if (data) {
        // Push current state to navigation stack
        setNavigationStack((prev) => [...prev, { path: currentPath, data }]);

        // Pre-fetch the new directory to ensure smooth navigation
        queryClient.prefetchQuery({
          queryKey: ['directories', path],
          queryFn: async () => {
            return await apiClient.browseDirectory({ path });
          },
          staleTime: 30000,
        });
      }
      setCurrentPath(path);
    },
    [data, currentPath, queryClient],
  );

  const navigateBack = useCallback(() => {
    const previousItem = navigationStack[navigationStack.length - 1];
    if (previousItem) {
      setNavigationStack((prev) => prev.slice(0, -1));
      setCurrentPath(previousItem.path);
    } else if (data?.parentPath) {
      setCurrentPath(data.parentPath);
    }
  }, [navigationStack, data?.parentPath]);

  const navigateToParent = useCallback(() => {
    if (data?.parentPath) {
      // Push current state to navigation stack
      setNavigationStack((prev) => [...prev, { path: currentPath, data }]);

      // Pre-fetch the parent directory
      queryClient.prefetchQuery({
        queryKey: ['directories', data.parentPath],
        queryFn: async () => {
          if (!data.parentPath) {
            throw new Error('Parent path is not available');
          }
          return await apiClient.browseDirectory({ path: data.parentPath });
        },
        staleTime: 30000,
      });

      setCurrentPath(data.parentPath);
    }
  }, [data, currentPath, queryClient]);

  const canGoBack = navigationStack.length > 0 || data?.parentPath !== null;

  return {
    // Data
    currentPath: data?.currentPath,
    parentPath: data?.parentPath,
    directories:
      data?.items?.filter(
        (item): item is typeof item & { type: 'directory' } => item.type === 'directory',
      ) || [],

    // State
    isLoading,
    error,

    // Actions
    navigateToDirectory,
    navigateBack,
    navigateToParent,
    refetch,

    // Computed
    canGoBack,
    pathSegments: data?.currentPath?.split('/').filter(Boolean) || [],
    navigationDepth: navigationStack.length,
  };
}
