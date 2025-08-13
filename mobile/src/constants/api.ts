// @ts-ignore - Expo provides process.env at build time
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

// Legacy query keys (can be migrated to generated query keys)
export const QUERY_KEYS = {
  app: {
    status: ['app', 'status'] as const,
  },
} as const;
