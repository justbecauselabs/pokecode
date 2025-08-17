// Re-export all API types from the new Zod-based client
export * from '@/api/client';

// API error interface
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}
