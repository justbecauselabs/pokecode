/**
 * Type-safe API client using Zod schemas
 *
 * This client provides full type safety using Zod schemas for both
 * request and response validation, eliminating the need for code generation.
 */

// Import schemas
import {
  CreateMessageBodySchema,
  type CreateMessageRequest,
  type CreateMessageResponse,
  CreateMessageResponseSchema,
  type CreateSessionRequest,
  CreateSessionRequestSchema,
  type GetMessagesResponse,
  GetMessagesResponseSchema,
  type ListSessionsQuery,
  ListSessionsQuerySchema,
  type ListSessionsResponse,
  ListSessionsResponseSchema,
  type Session,
  type SessionIdParams,
  SessionIdParamsSchema,
  type SessionParams,
  SessionParamsSchema,
  SessionSchema,
  type UpdateSessionRequest,
  UpdateSessionRequestSchema,
} from '@pokecode/api';
import { z } from 'zod';
import { API_BASE_URL } from '@/constants/api';
import { useSettingsStore } from '@/stores/settingsStore';

// Temporary type definition for query parameters
type GetMessagesQuery = {
  after?: string;
  limit?: number;
};

import {
  // Directory schemas
  type BrowseDirectoryQuery,
  BrowseDirectoryQuerySchema,
  type BrowseDirectoryResponse,
  BrowseDirectoryResponseSchema,
  // Agent schemas
  type ListAgentsQuery,
  ListAgentsQuerySchema,
  type ListAgentsResponse,
  ListAgentsResponseSchema,
  // Command schemas
  type ListCommandsQuery,
  ListCommandsQuerySchema,
  type ListCommandsResponse,
  ListCommandsResponseSchema,
  // Repository schemas
  type ListRepositoriesResponse,
  ListRepositoriesResponseSchema,
} from '@pokecode/api';

// Response schemas for other endpoints
const HealthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
});

// Using imported RepositoryResponseSchema and ListRepositoriesResponseSchema from @pokecode/api

const FileSchema = z.object({
  path: z.string(),
  name: z.string(),
  type: z.union([z.literal('file'), z.literal('directory')]),
  size: z.number().optional(),
  modifiedAt: z.string().optional(),
});

const FilesResponseSchema = z.object({
  files: z.array(FileSchema),
  currentPath: z.string(),
});

const FileContentSchema = z.object({
  path: z.string(),
  content: z.string(),
  encoding: z.string(),
  size: z.number(),
  mimeType: z.string(),
  modifiedAt: z.string(),
});

const FileOperationResponseSchema = z.object({
  success: z.boolean(),
  path: z.string(),
});

const DeleteResponseSchema = z.object({
  success: z.boolean(),
});

type HealthResponse = z.infer<typeof HealthResponseSchema>;
// Using imported Repository and ListRepositoriesResponse types from @pokecode/api
type File = z.infer<typeof FileSchema>;
type FilesResponse = z.infer<typeof FilesResponseSchema>;
type FileContent = z.infer<typeof FileContentSchema>;
type FileOperationResponse = z.infer<typeof FileOperationResponseSchema>;
type DeleteResponse = z.infer<typeof DeleteResponseSchema>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
}

/**
 * Get the effective API base URL from settings or default
 */
function getEffectiveBaseUrl(): string {
  const customApiBaseUrl = useSettingsStore.getState().customApiBaseUrl;
  return customApiBaseUrl || API_BASE_URL;
}

/**
 * Check if debug logging is enabled
 */
function isDebugEnabled(): boolean {
  return false;
  // TODO: Enable debug logging in development
  // if (__DEV__) return true;
  // const customApiBaseUrl = useSettingsStore.getState().customApiBaseUrl;
  // return !!customApiBaseUrl;
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
 * Helper to format error logs
 */
function errorLog(message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ${message}`, data || '');
}

class APIClient {
  private defaultHeaders: Record<string, string>;

  constructor() {
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  public getCurrentBaseUrl(): string {
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
          // Keep numbers as numbers for JSON serialization in POST body,
          // but URLSearchParams always converts to strings for GET requests
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
    responseSchema: z.ZodSchema<T>;
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
        ...(hasBody ? this.defaultHeaders : {}),
        ...params.options?.headers,
      },
    };

    if (hasBody) {
      config.body = JSON.stringify(params.options?.body);
    }

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
      throw new Error(
        `Network Error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
      );
    }

    debugLog(`API Response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorBody = '';
      try {
        const clonedResponse = response.clone();
        errorBody = await clonedResponse.text();
        errorLog(`API Error Response Body:`, errorBody);
      } catch (bodyError) {
        errorLog(`API Error: Could not read error response body:`, bodyError);
      }

      const errorMessage = `API Error: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`;
      errorLog(`API Error Details: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    try {
      const contentLength = response.headers.get('content-length');
      const contentType = response.headers.get('content-type');

      // Handle empty responses
      if (contentLength === '0' || response.status === 204) {
        debugLog('API Success Response: Empty response (no content)');
        return {} as T;
      }

      // Only parse JSON if content-type indicates JSON
      if (contentType?.includes('application/json')) {
        const jsonResponse = await response.json();
        debugLog(`API Success Response data:`, jsonResponse);

        // Validate response using Zod schema
        const validatedResponse = params.responseSchema.parse(jsonResponse);
        return validatedResponse;
      } else {
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
      errorLog(`API Parse/Validation Error:`, parseError);
      if (parseError instanceof z.ZodError) {
        errorLog(`API Validation Issues:`, parseError.issues);
        throw new Error(
          `Response validation failed: ${parseError.issues.map((i) => i.message).join(', ')}`
        );
      }
      throw new Error(
        `Invalid response: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      );
    }
  }

  // Health endpoints
  async getHealth(): Promise<HealthResponse> {
    return this.request({
      path: '/health/',
      responseSchema: HealthResponseSchema,
    });
  }

  // Repository endpoints
  async getRepositories(): Promise<ListRepositoriesResponse> {
    return this.request({
      path: '/api/repositories/',
      responseSchema: ListRepositoriesResponseSchema,
    });
  }

  // Directory endpoints
  async browseDirectory(query?: BrowseDirectoryQuery): Promise<BrowseDirectoryResponse> {
    // Validate query params if provided
    const validatedQuery = query ? BrowseDirectoryQuerySchema.parse(query) : undefined;

    return this.request({
      path: '/api/directories/browse',
      options: { query: validatedQuery },
      responseSchema: BrowseDirectoryResponseSchema,
    });
  }

  // Session endpoints
  async getSessions(query?: ListSessionsQuery): Promise<ListSessionsResponse> {
    // Validate query params if provided
    const validatedQuery = query ? ListSessionsQuerySchema.parse(query) : undefined;

    return this.request({
      path: '/api/sessions/',
      options: { query: validatedQuery },
      responseSchema: ListSessionsResponseSchema,
    });
  }

  async createSession(data?: CreateSessionRequest): Promise<Session> {
    // Validate request body if provided
    const validatedData = data ? CreateSessionRequestSchema.parse(data) : undefined;

    return this.request({
      path: '/api/sessions/',
      options: { method: 'POST', body: validatedData },
      responseSchema: SessionSchema,
    });
  }

  async getSession(params: { sessionId: string }): Promise<Session> {
    // Validate path params
    const validatedParams = SessionParamsSchema.parse(params);

    return this.request({
      path: '/api/sessions/{sessionId}',
      pathParams: validatedParams,
      responseSchema: SessionSchema,
    });
  }

  async updateSession(params: { sessionId: string; data: UpdateSessionRequest }): Promise<Session> {
    // Validate path params and body
    const validatedParams = SessionParamsSchema.parse({ sessionId: params.sessionId });
    const validatedData = UpdateSessionRequestSchema.parse(params.data);

    return this.request({
      path: '/api/sessions/{sessionId}',
      pathParams: validatedParams,
      options: { method: 'PATCH', body: validatedData },
      responseSchema: SessionSchema,
    });
  }

  async deleteSession(params: { sessionId: string }): Promise<DeleteResponse> {
    const validatedParams = SessionParamsSchema.parse(params);

    return this.request({
      path: '/api/sessions/{sessionId}',
      pathParams: validatedParams,
      options: { method: 'DELETE' },
      responseSchema: DeleteResponseSchema,
    });
  }

  // Message endpoints
  async getMessages(params: {
    sessionId: string;
    query?: GetMessagesQuery;
  }): Promise<GetMessagesResponse> {
    const validatedParams = SessionIdParamsSchema.parse({ sessionId: params.sessionId });
    const validatedQuery = params.query; // Direct assignment since schema isn't exported yet

    return this.request({
      path: '/api/sessions/{sessionId}/messages',
      pathParams: validatedParams,
      options: { query: validatedQuery },
      responseSchema: GetMessagesResponseSchema,
    });
  }

  async sendMessage(params: {
    sessionId: string;
    data: CreateMessageRequest;
  }): Promise<CreateMessageResponse> {
    const validatedParams = SessionIdParamsSchema.parse({ sessionId: params.sessionId });
    const validatedData = CreateMessageBodySchema.parse(params.data);

    return this.request({
      path: '/api/sessions/{sessionId}/messages',
      pathParams: validatedParams,
      options: { method: 'POST', body: validatedData },
      responseSchema: CreateMessageResponseSchema,
    });
  }

  async cancelSession(params: { sessionId: string }): Promise<{ success: boolean }> {
    const validatedParams = SessionIdParamsSchema.parse(params);

    return this.request({
      path: '/api/claude-code/sessions/{sessionId}/cancel',
      pathParams: validatedParams,
      options: { method: 'POST' },
      responseSchema: z.object({ success: z.boolean() }),
    });
  }

  // File endpoints
  async getFiles(params: {
    sessionId: string;
    query?: { path?: string; recursive?: boolean };
  }): Promise<FilesResponse> {
    const validatedParams = SessionIdParamsSchema.parse({ sessionId: params.sessionId });

    return this.request({
      path: '/api/claude-code/sessions/{sessionId}/files/',
      pathParams: validatedParams,
      options: { query: params.query },
      responseSchema: FilesResponseSchema,
    });
  }

  async getFile(params: { sessionId: string; filePath: string }): Promise<FileContent> {
    const validatedParams = SessionIdParamsSchema.parse({ sessionId: params.sessionId });

    return this.request({
      path: '/api/claude-code/sessions/{sessionId}/files/{*}',
      pathParams: { ...validatedParams, '*': params.filePath },
      responseSchema: FileContentSchema,
    });
  }

  async createFile(params: {
    sessionId: string;
    filePath: string;
    content: string;
    encoding?: string;
  }): Promise<FileOperationResponse> {
    const validatedParams = SessionIdParamsSchema.parse({ sessionId: params.sessionId });

    return this.request({
      path: '/api/claude-code/sessions/{sessionId}/files/{*}',
      pathParams: { ...validatedParams, '*': params.filePath },
      options: {
        method: 'POST',
        body: { content: params.content, encoding: params.encoding },
      },
      responseSchema: FileOperationResponseSchema,
    });
  }

  async updateFile(params: {
    sessionId: string;
    filePath: string;
    content: string;
    encoding?: string;
  }): Promise<FileOperationResponse> {
    const validatedParams = SessionIdParamsSchema.parse({ sessionId: params.sessionId });

    return this.request({
      path: '/api/claude-code/sessions/{sessionId}/files/{*}',
      pathParams: { ...validatedParams, '*': params.filePath },
      options: {
        method: 'PUT',
        body: { content: params.content, encoding: params.encoding },
      },
      responseSchema: FileOperationResponseSchema,
    });
  }

  async deleteFile(params: {
    sessionId: string;
    filePath: string;
  }): Promise<FileOperationResponse> {
    const validatedParams = SessionIdParamsSchema.parse({ sessionId: params.sessionId });

    return this.request({
      path: '/api/claude-code/sessions/{sessionId}/files/{*}',
      pathParams: { ...validatedParams, '*': params.filePath },
      options: { method: 'DELETE' },
      responseSchema: FileOperationResponseSchema,
    });
  }

  // Agent endpoints
  async getAgents(params: {
    sessionId: string;
    query?: ListAgentsQuery;
  }): Promise<ListAgentsResponse> {
    const validatedParams = SessionIdParamsSchema.parse({ sessionId: params.sessionId });
    const validatedQuery = params.query ? ListAgentsQuerySchema.parse(params.query) : undefined;

    return this.request({
      path: '/api/claude-code/sessions/{sessionId}/agents/',
      pathParams: validatedParams,
      options: { query: validatedQuery },
      responseSchema: ListAgentsResponseSchema,
    });
  }

  // Commands endpoints
  async getCommands(params: {
    sessionId: string;
    query?: ListCommandsQuery;
  }): Promise<ListCommandsResponse> {
    const validatedParams = SessionIdParamsSchema.parse({ sessionId: params.sessionId });
    const validatedQuery = params.query ? ListCommandsQuerySchema.parse(params.query) : undefined;

    return this.request({
      path: '/api/claude-code/sessions/{sessionId}/commands/',
      pathParams: validatedParams,
      options: { query: validatedQuery },
      responseSchema: ListCommandsResponseSchema,
    });
  }
}

export const apiClient = new APIClient();

// Export all types for use throughout the app
export type {
  // Session types
  CreateSessionRequest,
  ListSessionsQuery,
  ListSessionsResponse,
  Session,
  UpdateSessionRequest,
  SessionParams,
  // Message types
  CreateMessageRequest,
  CreateMessageResponse,
  GetMessagesResponse,
  SessionIdParams,
  // Agent types
  ListAgentsQuery,
  ListAgentsResponse,
  // Command types
  ListCommandsQuery,
  ListCommandsResponse,
  // Directory types
  BrowseDirectoryQuery,
  BrowseDirectoryResponse,
  // Other types
  HealthResponse,
  File,
  FilesResponse,
  FileContent,
  FileOperationResponse,
  DeleteResponse,
};
