/**
 * Error handling utilities for the CLI application
 */

import chalk from 'chalk';
import type { ApiError } from '../types/api';

export class CliError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'CliError';
  }
}

export class AuthError extends CliError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthError';
  }
}

export class NetworkError extends CliError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

export class SessionError extends CliError {
  constructor(message: string) {
    super(message, 'SESSION_ERROR');
    this.name = 'SessionError';
  }
}

/**
 * Format error message for display in terminal
 */
export function formatError(error: unknown): string {
  if (error instanceof AuthError) {
    return chalk.red('⚠ Authentication failed: ') + error.message;
  }
  
  if (error instanceof NetworkError) {
    return chalk.red('⚠ Network error: ') + error.message;
  }
  
  if (error instanceof SessionError) {
    return chalk.red('⚠ Session error: ') + error.message;
  }
  
  if (error instanceof CliError) {
    return chalk.red(`⚠ ${error.code}: `) + error.message;
  }
  
  if (error instanceof Error) {
    return chalk.red('⚠ Error: ') + error.message;
  }
  
  return chalk.red('⚠ Unknown error occurred');
}

/**
 * Parse API error response
 */
export function parseApiError(response: unknown): string {
  if (typeof response === 'object' && response !== null) {
    const apiError = response as Partial<ApiError>;
    return apiError.message || apiError.error || 'Unknown API error';
  }
  return 'Unknown API error';
}

/**
 * User-friendly error messages
 */
export const ErrorMessages = {
  NETWORK_UNAVAILABLE: 'Unable to connect to server. Please check your internet connection.',
  AUTH_REQUIRED: 'Authentication required. Please login to continue.',
  TOKEN_EXPIRED: 'Your session has expired. Please login again.',
  SESSION_NOT_FOUND: 'Session not found. Please create a new session.',
  INVALID_CREDENTIALS: 'Invalid email or password. Please try again.',
  SERVER_ERROR: 'Server error occurred. Please try again later.',
  STREAM_INTERRUPTED: 'Message stream was interrupted. Attempting to reconnect...',
  CONFIG_ERROR: 'Failed to access configuration. Please check permissions.',
} as const;