import {
  type Provider,
  type ProviderInput,
  ProviderInputSchema,
  ProviderSchema,
} from '@pokecode/types';
import { z } from 'zod';

// ID validation schema - accept any string format
const idSchema = z.string();

// Create session schemas
export const CreateSessionRequestSchema = z.object({
  projectPath: z.string().min(1),
  // Accept legacy aliases (e.g., 'claude', 'codex') but normalize to canonical Provider
  provider: ProviderInputSchema,
});

export const SessionSchema = z.object({
  id: idSchema,
  provider: ProviderSchema,
  projectPath: z.string(),
  name: z.string(),
  claudeDirectoryPath: z.string().nullable(),
  state: z.union([z.literal('active'), z.literal('inactive')]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastAccessedAt: z.string().datetime(),
  lastMessageSentAt: z.string().datetime().nullable(),
  // Working state fields
  isWorking: z.boolean(),
  currentJobId: z.string().nullable(),
  lastJobStatus: z.string().nullable(),
  // Token and message tracking
  messageCount: z.number().int().min(0).default(0),
  tokenCount: z.number().int().min(0).default(0),
});

// List sessions schemas
export const ListSessionsQuerySchema = z.object({
  state: z.union([z.literal('active'), z.literal('inactive')]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});

export const ListSessionsResponseSchema = z.object({
  sessions: z.array(SessionSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});

// Update session schemas
export const UpdateSessionRequestSchema = z.object({
  context: z.string().max(5000).optional(),
  metadata: z.any().optional(),
});

// Session params schema
export const SessionParamsSchema = z.object({
  sessionId: idSchema,
});

// Type exports
// Explicit TS types to ensure stable .d.ts output across package boundaries
export type CreateSessionRequest = { projectPath: string; provider: ProviderInput };
export type Session = {
  id: string;
  provider: Provider;
  projectPath: string;
  name: string;
  claudeDirectoryPath: string | null;
  state: 'active' | 'inactive';
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  lastAccessedAt: string; // ISO timestamp
  lastMessageSentAt: string | null; // ISO timestamp or null if none
  isWorking: boolean;
  currentJobId: string | null;
  lastJobStatus: string | null;
  messageCount: number;
  tokenCount: number;
};
export type ListSessionsQuery = z.infer<typeof ListSessionsQuerySchema>;
export type ListSessionsResponse = z.infer<typeof ListSessionsResponseSchema>;
export type UpdateSessionRequest = z.infer<typeof UpdateSessionRequestSchema>;
export type SessionParams = z.infer<typeof SessionParamsSchema>;

// Sanity export to verify declaration emitter honors explicit aliases
export type __SessionSchemaHasProvider = typeof SessionSchema extends z.ZodTypeAny ? true : false;
