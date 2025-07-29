export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export const API_ENDPOINTS = {
  auth: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    refresh: '/api/auth/refresh',
    me: '/api/auth/me',
  },
  sessions: {
    list: '/api/claude-code/sessions',
    create: '/api/claude-code/sessions',
    get: (id: string) => `/api/claude-code/sessions/${id}`,
    delete: (id: string) => `/api/claude-code/sessions/${id}`,
  },
  prompts: {
    create: '/api/claude-code/prompts',
    stream: (sessionId: string, promptId: string) => 
      `/api/claude-code/sessions/${sessionId}/prompts/${promptId}/stream`,
  },
  files: {
    list: (sessionId: string, path?: string) => 
      `/api/claude-code/sessions/${sessionId}/files${path ? `?path=${encodeURIComponent(path)}` : ''}`,
    content: (sessionId: string, path: string) => 
      `/api/claude-code/sessions/${sessionId}/files/content?path=${encodeURIComponent(path)}`,
  },
} as const;

export const QUERY_KEYS = {
  auth: {
    user: ['auth', 'user'] as const,
  },
  sessions: {
    all: ['sessions'] as const,
    list: () => ['sessions', 'list'] as const,
    detail: (id: string) => ['sessions', 'detail', id] as const,
  },
  files: {
    all: ['files'] as const,
    list: (sessionId: string, path: string) => ['files', 'list', sessionId, path] as const,
    content: (sessionId: string, path: string) => ['files', 'content', sessionId, path] as const,
  },
  prompts: {
    all: ['prompts'] as const,
    list: (sessionId: string) => ['prompts', 'list', sessionId] as const,
  },
} as const;