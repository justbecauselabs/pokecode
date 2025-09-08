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

// Device model for listings
export const DeviceSchema = z.object({
  deviceId: z.string(),
  deviceName: z.string(),
  platform: z.union([z.literal('ios'), z.literal('android')]).nullable(),
  appVersion: z.string().nullable(),
  lastConnectedAt: z.string().datetime(),
});
export type Device = z.infer<typeof DeviceSchema>;

export const ListDevicesQuerySchema = z.object({
  activeWithinSeconds: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 60 * 60)
    .default(3600)
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});
export type ListDevicesQuery = z.infer<typeof ListDevicesQuerySchema>;

export const ListDevicesResponseSchema = z.object({
  devices: z.array(DeviceSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});
export type ListDevicesResponse = z.infer<typeof ListDevicesResponseSchema>;
