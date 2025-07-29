import { apiClient } from './client';
import { API_ENDPOINTS } from '@/constants/api';
import { FileNode } from '@/types/api';

export const filesApi = {
  async list(sessionId: string, path?: string): Promise<FileNode[]> {
    return apiClient.get<FileNode[]>(API_ENDPOINTS.files.list(sessionId, path));
  },

  async getContent(sessionId: string, path: string): Promise<{ content: string; language?: string }> {
    return apiClient.get<{ content: string; language?: string }>(
      API_ENDPOINTS.files.content(sessionId, path)
    );
  },

  async create(sessionId: string, path: string, content: string): Promise<void> {
    return apiClient.post<void>('/api/claude-code/sessions/' + sessionId + '/files', {
      path,
      content,
    });
  },

  async update(sessionId: string, path: string, content: string): Promise<void> {
    return apiClient.put<void>('/api/claude-code/sessions/' + sessionId + '/files', {
      path,
      content,
    });
  },

  async delete(sessionId: string, path: string): Promise<void> {
    return apiClient.delete<void>(
      `/api/claude-code/sessions/${sessionId}/files?path=${encodeURIComponent(path)}`
    );
  },
};