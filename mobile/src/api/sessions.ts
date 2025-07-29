import { apiClient } from './client';
import { API_ENDPOINTS } from '@/constants/api';
import { Session, CreateSessionRequest } from '@/types/api';

export const sessionsApi = {
  async list(): Promise<Session[]> {
    return apiClient.get<Session[]>(API_ENDPOINTS.sessions.list);
  },

  async create(data: CreateSessionRequest): Promise<Session> {
    return apiClient.post<Session>(API_ENDPOINTS.sessions.create, data);
  },

  async get(id: string): Promise<Session> {
    return apiClient.get<Session>(API_ENDPOINTS.sessions.get(id));
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete<void>(API_ENDPOINTS.sessions.delete(id));
  },

  async update(id: string, data: Partial<Session>): Promise<Session> {
    return apiClient.patch<Session>(API_ENDPOINTS.sessions.get(id), data);
  },
};