import { z } from 'zod';

// Request body for POST /api/connect
export const ConnectRequestSchema = z.object({
  device_id: z.string().min(1).max(128),
  device_name: z
    .string()
    .min(1)
    .max(128)
    .transform((s) => s.trim()),
  platform: z.enum(['ios', 'android']).optional(),
  app_version: z.string().max(64).optional(),
});
export type ConnectRequest = z.infer<typeof ConnectRequestSchema>;

// Successful response
export const ConnectResponseSchema = z.object({
  status: z.literal('ok'),
  poll_interval_s: z.number().int().positive(),
  server_time: z.string(),
});
export type ConnectResponse = z.infer<typeof ConnectResponseSchema>;

// Generic error response for this endpoint
export const ConnectErrorResponseSchema = z.object({
  error: z.string(),
  code: z.enum(['INVALID_BODY', 'INTERNAL']).optional(),
});
export type ConnectErrorResponse = z.infer<typeof ConnectErrorResponseSchema>;
