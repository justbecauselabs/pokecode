/**
 * React Native compatible API client using generated types
 *
 * This wrapper provides a React Native compatible interface
 * while leveraging the generated TypeScript types for type safety.
 */

import { API_BASE_URL } from '@/constants/api';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Get the effective API base URL from settings or default
 */
function getEffectiveBaseUrl(): string {
  const customApiBaseUrl = useSettingsStore.getState().customApiBaseUrl;
  return customApiBaseUrl || API_BASE_URL;
}

/**
 * Check if debug logging is enabled
 * Enable in development or when custom API URL is set (for troubleshooting)
 */
function isDebugEnabled(): boolean {
  // Enable debug in development
  if (__DEV__) return true;
  
  // Enable debug when using custom API URL (for troubleshooting)
  const customApiBaseUrl = useSettingsStore.getState().customApiBaseUrl;
  return !!customApiBaseUrl;
}

/**
 * Helper to format debug logs with timestamp
 */
function debugLog(message: string, data?: unknown): void {
  if (isDebugEnabled()) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`, data || '');
  }
}

/**
 * Helper to format error logs (always logged regardless of debug setting)
 */
function errorLog(message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ${message}`, data || '');
}

// Import generated types for type safety
import type {
  GetApiClaudeCodeRepositoriesResponse,
  GetApiClaudeCodeSessionsBySessionIdCommandsData,
  GetApiClaudeCodeSessionsBySessionIdCommandsResponse,
  GetApiClaudeCodeSessionsBySessionIdFilesData,
  GetApiClaudeCodeSessionsBySessionIdFilesResponse,
  GetApiClaudeCodeSessionsBySessionIdMessagesResponse,
  GetApiClaudeCodeSessionsBySessionIdResponse,
  GetApiClaudeCodeSessionsData,
  GetApiClaudeCodeSessionsResponse,
  GetHealthResponse,
  PatchApiClaudeCodeSessionsBySessionIdData,
  PatchApiClaudeCodeSessionsBySessionIdResponse,
  PostApiClaudeCodeSessionsBySessionIdMessagesData,
  PostApiClaudeCodeSessionsBySessionIdMessagesResponse,
  PostApiClaudeCodeSessionsData,
  PostApiClaudeCodeSessionsResponse,
} from './generated';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
}

class ReactNativeAPIClient {
  private defaultHeaders: Record<string, string>;

  constructor() {
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Get the current base URL, checking settings for any custom override
   */
  private getCurrentBaseUrl(): string {
    return getEffectiveBaseUrl();
  }

  private buildUrl(params: {
    path: string;
    pathParams?: Record<string, string>;
    query?: Record<string, unknown>;
  }): string {
    let url = `${this.getCurrentBaseUrl()}${params.path}`;

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

  private async request<T>(params: {
    path: string;
    options?: RequestOptions;
    pathParams?: Record<string, string>;
  }): Promise<T> {
    const url = this.buildUrl({
      path: params.path,
      pathParams: params.pathParams,
      query: params.options?.query,
    });

    const method = params.options?.method || 'GET';
    const hasBody =
      params.options?.body && (method === 'POST' || method === 'PUT' || method === 'PATCH');

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

    // Debug logging for request details
    debugLog(`API Request: ${method} ${url}`);
    debugLog(`API Request Base URL: ${this.getCurrentBaseUrl()}`);
    debugLog(`API Request Headers:`, config.headers);
    if (hasBody) {
      debugLog(`API Request Body:`, config.body);
    }

    let response: Response;
    try {
      response = await fetch(url, config);
    } catch (fetchError) {
      errorLog(`API Network/Fetch Error:`, fetchError);
      errorLog(`API Failed URL: ${url}`);
      errorLog(`API Request Config:`, config);
      throw new Error(`Network Error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
    }

    // Log response details
    debugLog(`API Response: ${response.status} ${response.statusText}`);
    debugLog(`API Response Headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      let errorBody = '';
      try {
        // Try to read the error response body
        const clonedResponse = response.clone();
        errorBody = await clonedResponse.text();
        errorLog(`API Error Response Body:`, errorBody);
      } catch (bodyError) {
        errorLog(`API Error: Could not read error response body:`, bodyError);
      }

      const errorMessage = `API Error: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`;
      errorLog(`API Error Details: ${errorMessage}`);
      errorLog(`API Error Request URL: ${url}`);
      errorLog(`API Error Request Method: ${method}`);
      
      throw new Error(errorMessage);
    }

    try {
      // Check if response has content before trying to parse JSON
      const contentLength = response.headers.get('content-length');
      const contentType = response.headers.get('content-type');
      
      // Handle empty responses (like 202 with no content)
      if (contentLength === '0' || response.status === 204) {
        debugLog('API Success Response: Empty response (no content)');
        return {} as T;
      }
      
      // Only parse JSON if content-type indicates JSON
      if (contentType?.includes('application/json')) {
        const jsonResponse = await response.json();
        debugLog(`API Success Response data:`, jsonResponse);
        return jsonResponse;
      } else {
        // Non-JSON response, return text or empty object
        const textResponse = await response.text();
        if (textResponse) {
          debugLog(`API Success Response (text):`, textResponse);
          return textResponse as unknown as T;
        } else {
          debugLog('API Success Response: Empty response');
          return {} as T;
        }
      }
    } catch (parseError) {
      errorLog(`API JSON Parse Error:`, parseError);
      errorLog(`API Error: Response was not valid JSON`);
      throw new Error(`Invalid JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
  }

  // Health endpoints
  async getHealth(): Promise<GetHealthResponse> {
    return this.request<GetHealthResponse>({ path: '/health/' });
  }

  // Repository endpoints
  async getRepositories(): Promise<GetApiClaudeCodeRepositoriesResponse> {
    return this.request<GetApiClaudeCodeRepositoriesResponse>({
      path: '/api/claude-code/repositories/',
    });
  }

  // Session endpoints
  async getSessions(
    params?: GetApiClaudeCodeSessionsData['query']
  ): Promise<GetApiClaudeCodeSessionsResponse> {
    return this.request<GetApiClaudeCodeSessionsResponse>({
      path: '/api/claude-code/sessions/',
      options: { query: params },
    });
  }

  async createSession(
    data?: PostApiClaudeCodeSessionsData['body']
  ): Promise<PostApiClaudeCodeSessionsResponse> {
    return this.request<PostApiClaudeCodeSessionsResponse>({
      path: '/api/claude-code/sessions/',
      options: { method: 'POST', body: data },
    });
  }

  async getSession(params: {
    sessionId: string;
  }): Promise<GetApiClaudeCodeSessionsBySessionIdResponse> {
    return this.request<GetApiClaudeCodeSessionsBySessionIdResponse>({
      path: '/api/claude-code/sessions/{sessionId}',
      pathParams: params,
    });
  }

  async updateSession(params: {
    sessionId: string;
    data: PatchApiClaudeCodeSessionsBySessionIdData['body'];
  }): Promise<PatchApiClaudeCodeSessionsBySessionIdResponse> {
    return this.request<PatchApiClaudeCodeSessionsBySessionIdResponse>({
      path: '/api/claude-code/sessions/{sessionId}',
      pathParams: { sessionId: params.sessionId },
      options: { method: 'PATCH', body: params.data },
    });
  }

  async deleteSession(params: { sessionId: string }): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>({
      path: '/api/claude-code/sessions/{sessionId}',
      pathParams: params,
      options: { method: 'DELETE' },
    });
  }

  // Message endpoints
  async getMessages(params: {
    sessionId: string;
  }): Promise<GetApiClaudeCodeSessionsBySessionIdMessagesResponse> {
    return this.request<GetApiClaudeCodeSessionsBySessionIdMessagesResponse>({
      path: '/api/claude-code/sessions/{sessionId}/messages',
      pathParams: params,
    });
  }

  async sendMessage(params: {
    sessionId: string;
    data: PostApiClaudeCodeSessionsBySessionIdMessagesData['body'];
  }): Promise<PostApiClaudeCodeSessionsBySessionIdMessagesResponse> {
    return this.request<PostApiClaudeCodeSessionsBySessionIdMessagesResponse>({
      path: '/api/claude-code/sessions/{sessionId}/messages',
      pathParams: { sessionId: params.sessionId },
      options: { method: 'POST', body: params.data },
    });
  }

  // File endpoints
  async getFiles(params: {
    sessionId: string;
    query?: GetApiClaudeCodeSessionsBySessionIdFilesData['query'];
  }): Promise<GetApiClaudeCodeSessionsBySessionIdFilesResponse> {
    return this.request<GetApiClaudeCodeSessionsBySessionIdFilesResponse>({
      path: '/api/claude-code/sessions/{sessionId}/files/',
      pathParams: { sessionId: params.sessionId },
      options: { query: params.query },
    });
  }

  async getFile(params: { sessionId: string; filePath: string }): Promise<{
    path: string;
    content: string;
    encoding: string;
    size: number;
    mimeType: string;
    modifiedAt: string;
  }> {
    return this.request({
      path: '/api/claude-code/sessions/{sessionId}/files/{*}',
      pathParams: { sessionId: params.sessionId, '*': params.filePath },
    });
  }

  async createFile(params: {
    sessionId: string;
    filePath: string;
    content: string;
    encoding?: string;
  }): Promise<{ success: boolean; path: string }> {
    return this.request({
      path: '/api/claude-code/sessions/{sessionId}/files/{*}',
      pathParams: { sessionId: params.sessionId, '*': params.filePath },
      options: { method: 'POST', body: { content: params.content, encoding: params.encoding } },
    });
  }

  async updateFile(params: {
    sessionId: string;
    filePath: string;
    content: string;
    encoding?: string;
  }): Promise<{ success: boolean; path: string }> {
    return this.request({
      path: '/api/claude-code/sessions/{sessionId}/files/{*}',
      pathParams: { sessionId: params.sessionId, '*': params.filePath },
      options: { method: 'PUT', body: { content: params.content, encoding: params.encoding } },
    });
  }

  async deleteFile(params: {
    sessionId: string;
    filePath: string;
  }): Promise<{ success: boolean; path: string }> {
    return this.request({
      path: '/api/claude-code/sessions/{sessionId}/files/{*}',
      pathParams: { sessionId: params.sessionId, '*': params.filePath },
      options: { method: 'DELETE' },
    });
  }

  // Commands endpoints
  async getCommands(params: {
    sessionId: string;
    query?: GetApiClaudeCodeSessionsBySessionIdCommandsData['query'];
  }): Promise<GetApiClaudeCodeSessionsBySessionIdCommandsResponse> {
    return this.request<GetApiClaudeCodeSessionsBySessionIdCommandsResponse>({
      path: '/api/claude-code/sessions/{sessionId}/commands/',
      pathParams: { sessionId: params.sessionId },
      options: { query: params.query },
    });
  }
}

export const apiClient = new ReactNativeAPIClient();
