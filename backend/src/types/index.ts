// JWT Token Payload
export interface TokenPayload {
  sub: string; // user ID
  email: string;
  iat?: number;
  exp?: number;
}

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: any) => Promise<void>;
    metrics?: {
      promptsTotal: any;
      activeSessionsGauge: any;
    };
    rateLimits?: {
      prompt: { max: number; timeWindow: string };
      file: { max: number; timeWindow: string };
      read: { max: number; timeWindow: string };
    };
  }
}

// API Response Types
export interface SessionResponse {
  id: string;
  userId: string;
  projectPath: string;
  context?: string;
  status: 'active' | 'inactive' | 'archived';
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
}

export interface PromptResponse {
  id: string;
  sessionId: string;
  prompt: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  jobId?: string;
  createdAt: string;
}

export interface PromptDetailResponse extends PromptResponse {
  response?: string;
  error?: string;
  metadata?: {
    allowedTools?: string[];
    toolCalls?: Array<{ tool: string; params: any; result?: any }>;
    duration?: number;
    tokenCount?: number;
  };
  completedAt?: string;
}

export interface FileInfo {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
}

export interface ListFilesResponse {
  files: FileInfo[];
  basePath: string;
}

export interface GetFileResponse {
  path: string;
  content: string;
  encoding: string;
  size: number;
  mimeType: string;
  modifiedAt: string;
}

// SSE Event Types
export interface StreamEvent {
  id?: string;
  event: 'message' | 'tool_use' | 'tool_result' | 'error' | 'complete';
  data: string; // JSON stringified payload
}

export interface MessageEvent {
  type: 'message';
  content: string;
  timestamp: string;
}

export interface ToolUseEvent {
  type: 'tool_use';
  tool: string;
  params: Record<string, any>;
  timestamp: string;
}

export interface ToolResultEvent {
  type: 'tool_result';
  tool: string;
  result: string;
  timestamp: string;
}

export interface CompleteEvent {
  type: 'complete';
  summary: {
    duration: number;
    tokenCount?: number;
    toolCallCount: number;
  };
  timestamp: string;
}

export interface ErrorEvent {
  type: 'error';
  error: string;
  timestamp: string;
}

// Queue Job Types
export interface PromptJobData {
  sessionId: string;
  promptId: string;
  prompt: string;
  allowedTools?: string[];
  projectPath: string;
}

// Error Types
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(
    message: string,
    public errors?: any,
  ) {
    super(400, message, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Authentication required') {
    super(401, message, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = 'Insufficient permissions') {
    super(403, message, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends ApiError {
  constructor(message = 'Rate limit exceeded') {
    super(429, message, 'RATE_LIMIT_ERROR');
  }
}
