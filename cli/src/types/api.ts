/**
 * API type definitions for PokeCode backend
 */

export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface Session {
  id: string;
  userId: string;
  projectPath: string;
  context?: string;
  status: 'active' | 'inactive' | 'archived';
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
}

export interface CreateSessionRequest {
  projectPath: string;
  context?: string;
  metadata?: Record<string, unknown>;
}

export interface Prompt {
  id: string;
  sessionId: string;
  userId: string;
  prompt: string;
  response?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromptRequest {
  prompt: string;
  allowedTools?: string[];
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}