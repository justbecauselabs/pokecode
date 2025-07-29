import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { filesApi } from '@/api/files';
import { QUERY_KEYS } from '@/constants/api';
import { FileNode } from '@/types/api';

export function useFileSystem(sessionId: string) {
  const queryClient = useQueryClient();

  const useFileList = (path?: string) => {
    return useQuery({
      queryKey: QUERY_KEYS.files.list(sessionId, path || ''),
      queryFn: () => filesApi.list(sessionId, path),
      staleTime: 30 * 1000, // 30 seconds
    });
  };

  const useFileContent = (path: string, enabled = true) => {
    return useQuery({
      queryKey: QUERY_KEYS.files.content(sessionId, path),
      queryFn: () => filesApi.getContent(sessionId, path),
      enabled: enabled && !!path,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  const createFile = useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      filesApi.create(sessionId, path, content),
    onSuccess: (_, { path }) => {
      const dirPath = path.substring(0, path.lastIndexOf('/'));
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.files.list(sessionId, dirPath),
      });
    },
  });

  const updateFile = useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      filesApi.update(sessionId, path, content),
    onSuccess: (_, { path }) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.files.content(sessionId, path),
      });
    },
  });

  const deleteFile = useMutation({
    mutationFn: (path: string) => filesApi.delete(sessionId, path),
    onSuccess: (_, path) => {
      const dirPath = path.substring(0, path.lastIndexOf('/'));
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.files.list(sessionId, dirPath),
      });
      queryClient.removeQueries({
        queryKey: QUERY_KEYS.files.content(sessionId, path),
      });
    },
  });

  const navigateToFile = (path: string) => {
    // This would be implemented by the screen using the hook
    // For example: router.push(`/files/${encodeURIComponent(path)}`);
  };

  const getFileExtension = (filename: string): string => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  };

  const getFileLanguage = (filename: string): string => {
    const ext = getFileExtension(filename);
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'h': 'c',
      'hpp': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'r': 'r',
      'sql': 'sql',
      'sh': 'bash',
      'bash': 'bash',
      'zsh': 'bash',
      'fish': 'bash',
      'ps1': 'powershell',
      'yml': 'yaml',
      'yaml': 'yaml',
      'json': 'json',
      'xml': 'xml',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'md': 'markdown',
      'mdx': 'markdown',
    };
    return languageMap[ext] || 'text';
  };

  return {
    useFileList,
    useFileContent,
    createFile,
    updateFile,
    deleteFile,
    navigateToFile,
    getFileExtension,
    getFileLanguage,
  };
}