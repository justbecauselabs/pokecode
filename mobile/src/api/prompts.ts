import { apiClient } from './client';
import { API_ENDPOINTS } from '@/constants/api';
import { CreatePromptData, Prompt } from '@/types/claude';

export const promptsApi = {
  async create(data: CreatePromptData): Promise<Prompt> {
    return apiClient.post<Prompt>(API_ENDPOINTS.prompts.create, data);
  },

  async list(sessionId: string): Promise<Prompt[]> {
    return apiClient.get<Prompt[]>(`/api/claude-code/sessions/${sessionId}/prompts`);
  },

  async get(sessionId: string, promptId: string): Promise<Prompt> {
    return apiClient.get<Prompt>(`/api/claude-code/sessions/${sessionId}/prompts/${promptId}`);
  },
};