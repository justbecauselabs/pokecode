// Re-export all types from the shared API package
export * from '@pokecode/api';

// API error interface
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}
