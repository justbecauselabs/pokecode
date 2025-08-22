import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'unhealthy']),
  timestamp: z.string(),
  services: z.object({
    database: z.enum(['healthy', 'unhealthy', 'unknown']),
    queue: z.enum(['healthy', 'unhealthy', 'unknown']),
  }),
  version: z.string(),
  uptime: z.number(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const LivenessResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
});

export type LivenessResponse = z.infer<typeof LivenessResponseSchema>;

export const ReadinessResponseSchema = z.union([
  z.object({
    status: z.literal('ready'),
    timestamp: z.string(),
  }),
  z.object({
    status: z.literal('not_ready'),
    timestamp: z.string(),
    reason: z.string(),
  }),
]);

export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;
