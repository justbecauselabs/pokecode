/**
 * React Native compatible API client using generated types
 * 
 * This wrapper provides a React Native compatible interface
 * while leveraging the generated TypeScript types for type safety.
 */

import { API_BASE_URL } from '@/constants/api';

// Import generated types for type safety
import type {
  GetHealthResponse,
  GetApiClaudeCodeRepositoriesResponse,
  GetApiClaudeCodeSessionsResponse,
  GetApiClaudeCodeSessionsData,
  PostApiClaudeCodeSessionsData,
  PostApiClaudeCodeSessionsResponse,
  GetApiClaudeCodeSessionsBySessionIdResponse,
  PatchApiClaudeCodeSessionsBySessionIdData,
  PatchApiClaudeCodeSessionsBySessionIdResponse,
  GetApiClaudeCodeSessionsBySessionIdMessagesResponse,
  PostApiClaudeCodeSessionsBySessionIdMessagesData,
  PostApiClaudeCodeSessionsBySessionIdMessagesResponse,
  GetApiClaudeCodeSessionsBySessionIdFilesResponse,
  GetApiClaudeCodeSessionsBySessionIdFilesData,
} from './generated';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
}

class ReactNativeAPIClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  private buildUrl(params: { path: string; pathParams?: Record<string, string>; query?: Record<string, unknown> }): string {
    let url = `${this.baseUrl}${params.path}`;
    
    // Replace path parameters
    if (params.pathParams) {
      for (const [key, value] of Object.entries(params.pathParams)) {
        url = url.replace(`{${key}}`, encodeURIComponent(value));
      }
    }
    
    // Add query parameters
    if (params.query) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params.query)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    
    return url;
  }

  private async request<T>(params: { path: string; options?: RequestOptions; pathParams?: Record<string, string> }): Promise<T> {
    const url = this.buildUrl({
      path: params.path,
      pathParams: params.pathParams,
      query: params.options?.query,
    });

    const method = params.options?.method || 'GET';
    const hasBody = params.options?.body && (method === 'POST' || method === 'PUT' || method === 'PATCH');

    const config: RequestInit = {
      method,
      headers: {
        // Only set Content-Type for requests that have a body
        ...(hasBody ? this.defaultHeaders : {}),
        ...params.options?.headers,
      },
    };

    if (hasBody) {
      config.body = JSON.stringify(params.options?.body);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Health endpoints
  async getHealth(): Promise<GetHealthResponse> {
    return this.request<GetHealthResponse>({ path: '/health/' });
  }

  // Repository endpoints
  async getRepositories(): Promise<GetApiClaudeCodeRepositoriesResponse> {
    return this.request<GetApiClaudeCodeRepositoriesResponse>({ path: '/api/claude-code/repositories/' });
  }

  // Session endpoints
  async getSessions(params?: GetApiClaudeCodeSessionsData['query']): Promise<GetApiClaudeCodeSessionsResponse> {
    return this.request<GetApiClaudeCodeSessionsResponse>({ 
      path: '/api/claude-code/sessions/',
      options: { query: params }
    });
  }

  async createSession(data?: PostApiClaudeCodeSessionsData['body']): Promise<PostApiClaudeCodeSessionsResponse> {
    return this.request<PostApiClaudeCodeSessionsResponse>({ 
      path: '/api/claude-code/sessions/',
      options: { method: 'POST', body: data }
    });
  }

  async getSession(params: { sessionId: string }): Promise<GetApiClaudeCodeSessionsBySessionIdResponse> {
    return this.request<GetApiClaudeCodeSessionsBySessionIdResponse>({ 
      path: '/api/claude-code/sessions/{sessionId}',
      pathParams: params
    });
  }

  async updateSession(params: { sessionId: string; data: PatchApiClaudeCodeSessionsBySessionIdData['body'] }): Promise<PatchApiClaudeCodeSessionsBySessionIdResponse> {
    return this.request<PatchApiClaudeCodeSessionsBySessionIdResponse>({ 
      path: '/api/claude-code/sessions/{sessionId}',
      pathParams: { sessionId: params.sessionId },
      options: { method: 'PATCH', body: params.data }
    });
  }

  async deleteSession(params: { sessionId: string }): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>({ 
      path: '/api/claude-code/sessions/{sessionId}',
      pathParams: params,
      options: { method: 'DELETE' }
    });
  }

  // Message endpoints
  async getMessages(params: { sessionId: string }): Promise<GetApiClaudeCodeSessionsBySessionIdMessagesResponse> {
    return this.request<GetApiClaudeCodeSessionsBySessionIdMessagesResponse>({ 
      path: '/api/claude-code/sessions/{sessionId}/messages',
      pathParams: params
    });
  }

  async sendMessage(params: { sessionId: string; data: PostApiClaudeCodeSessionsBySessionIdMessagesData['body'] }): Promise<PostApiClaudeCodeSessionsBySessionIdMessagesResponse> {
    return this.request<PostApiClaudeCodeSessionsBySessionIdMessagesResponse>({ 
      path: '/api/claude-code/sessions/{sessionId}/messages',
      pathParams: { sessionId: params.sessionId },
      options: { method: 'POST', body: params.data }
    });
  }

  // File endpoints
  async getFiles(params: { sessionId: string; query?: GetApiClaudeCodeSessionsBySessionIdFilesData['query'] }): Promise<GetApiClaudeCodeSessionsBySessionIdFilesResponse> {
    return this.request<GetApiClaudeCodeSessionsBySessionIdFilesResponse>({ 
      path: '/api/claude-code/sessions/{sessionId}/files/',
      pathParams: { sessionId: params.sessionId },
      options: { query: params.query }
    });
  }

  async getFile(params: { sessionId: string; filePath: string }): Promise<{ path: string; content: string; encoding: string; size: number; mimeType: string; modifiedAt: string }> {
    return this.request({ 
      path: '/api/claude-code/sessions/{sessionId}/files/{*}',
      pathParams: { sessionId: params.sessionId, '*': params.filePath }
    });
  }

  async createFile(params: { sessionId: string; filePath: string; content: string; encoding?: string }): Promise<{ success: boolean; path: string }> {
    return this.request({ 
      path: '/api/claude-code/sessions/{sessionId}/files/{*}',
      pathParams: { sessionId: params.sessionId, '*': params.filePath },
      options: { method: 'POST', body: { content: params.content, encoding: params.encoding } }
    });
  }

  async updateFile(params: { sessionId: string; filePath: string; content: string; encoding?: string }): Promise<{ success: boolean; path: string }> {
    return this.request({ 
      path: '/api/claude-code/sessions/{sessionId}/files/{*}',
      pathParams: { sessionId: params.sessionId, '*': params.filePath },
      options: { method: 'PUT', body: { content: params.content, encoding: params.encoding } }
    });
  }

  async deleteFile(params: { sessionId: string; filePath: string }): Promise<{ success: boolean; path: string }> {
    return this.request({ 
      path: '/api/claude-code/sessions/{sessionId}/files/{*}',
      pathParams: { sessionId: params.sessionId, '*': params.filePath },
      options: { method: 'DELETE' }
    });
  }
}

export const apiClient = new ReactNativeAPIClient();