// Re-export all generated API types
export * from '@/api/generated';

// Legacy API error interface (can be deprecated in favor of generated types)
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}
