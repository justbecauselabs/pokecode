import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type { BrowseDirectoryResponse } from '@/api/client';
import { apiClient } from '@/api/client';

interface DirectoryBrowserError {
  message: string;
  code?: string;
}

export function useDirectoryBrowser(initialPath?: string) {
  const [currentPath, setCurrentPath] = useState<string | undefined>(initialPath);
  const [navigationHistory, setNavigationHistory] = useState<string[]>([]);

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
      if (data?.currentPath) {
        setNavigationHistory((prev) => [...prev, data.currentPath]);
      }
      setCurrentPath(path);
    },
    [data?.currentPath]
  );

  const navigateBack = useCallback(() => {
    const previousPath = navigationHistory[navigationHistory.length - 1];
    if (previousPath) {
      setNavigationHistory((prev) => prev.slice(0, -1));
      setCurrentPath(previousPath);
    } else if (data?.parentPath) {
      setCurrentPath(data.parentPath);
    }
  }, [navigationHistory, data?.parentPath]);

  const navigateToParent = useCallback(() => {
    if (data?.parentPath) {
      if (data.currentPath) {
        setNavigationHistory((prev) => [...prev, data.currentPath]);
      }
      setCurrentPath(data.parentPath);
    }
  }, [data?.currentPath, data?.parentPath]);

  const canGoBack = navigationHistory.length > 0 || data?.parentPath !== null;

  return {
    // Data
    currentPath: data?.currentPath,
    parentPath: data?.parentPath,
    directories: data?.items?.filter((item): item is typeof item & { type: 'directory' } => item.type === 'directory') || [],

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
  };
}
