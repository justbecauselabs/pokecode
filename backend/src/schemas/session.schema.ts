import { z } from 'zod';

// Create session schemas
export const CreateSessionRequestSchema = z.object({
  projectPath: z
    .string()
    .regex(/^[a-zA-Z0-9._/-]+$/)
    .min(1)
    .max(255)
    .optional(),
  folderName: z
    .string()
    .regex(/^[a-zA-Z0-9._-]+$/)
    .min(1)
    .max(100)
    .optional(),
  context: z.string().max(5000).optional(),
  metadata: z
    .object({
      repository: z.string().optional(),
      branch: z.string().optional(),
      allowedTools: z.array(z.string()).optional(),
    })
    .optional(),
});

export const SessionSchema = z.object({
  id: z.string().uuid(),
  projectPath: z.string(),
  name: z.string(),
  claudeDirectoryPath: z.string().nullable(),
  context: z.string().nullable(),
  status: z.union([z.literal('active'), z.literal('idle'), z.literal('expired')]),
  metadata: z.any().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastAccessedAt: z.string().datetime(),
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
  status: z.union([z.literal('active'), z.literal('idle'), z.literal('expired')]).optional(),
  limit: z.number().int().min(1).max(100).default(20).optional(),
  offset: z.number().int().min(0).default(0).optional(),
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
  sessionId: z.string().uuid(),
});

// Type exports
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type ListSessionsQuery = z.infer<typeof ListSessionsQuerySchema>;
export type ListSessionsResponse = z.infer<typeof ListSessionsResponseSchema>;
export type UpdateSessionRequest = z.infer<typeof UpdateSessionRequestSchema>;
export type SessionParams = z.infer<typeof SessionParamsSchema>;
