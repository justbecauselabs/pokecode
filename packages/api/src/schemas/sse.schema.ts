import { z } from 'zod';
import { MessageSchema } from './message.schema';

// SSE event data schemas
export const SSEHeartbeatDataSchema = z.object({});

export const SSEUpdateDataSchema = z.object({
  state: z.enum(['running', 'done']),
  message: MessageSchema.nullable(),
});

// Main SSE event schema
export const SSEEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('heartbeat'),
    data: SSEHeartbeatDataSchema,
  }),
  z.object({
    type: z.literal('update'),
    data: SSEUpdateDataSchema,
  }),
]);

// Type exports
export type SSEHeartbeatData = z.infer<typeof SSEHeartbeatDataSchema>;
export type SSEUpdateData = z.infer<typeof SSEUpdateDataSchema>;
export type SSEEvent = z.infer<typeof SSEEventSchema>;

// Union type for the data property based on event type
export type SSEEventData = SSEHeartbeatData | SSEUpdateData;