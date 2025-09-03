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
    public errors?: unknown,
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

// Additional types needed by services
export interface CompleteEvent {
  type: 'complete';
  summary: {
    duration: number;
    tokenCount?: number;
    toolCallCount: number;
    stop_reason?: string;
  };
  timestamp: string;
}

export interface ErrorEvent {
  type: 'error';
  error: string;
  error_code?: string;
  timestamp: string;
}

// Queue Job Types
import type { Provider } from '@pokecode/types';

export interface PromptJobData {
  provider: Provider;
  sessionId: string;
  promptId: string;
  prompt: string;
  allowedTools?: string[] | undefined;
  projectPath: string;
  messageId?: string | undefined; // ID of the user message record in database
  model?: string; // Claude model to use
}
