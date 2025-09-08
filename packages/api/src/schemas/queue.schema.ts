import { z } from 'zod';

export const QueueMetricsSchema = z.object({
  waiting: z.number().int().min(0),
  active: z.number().int().min(0),
  completed: z.number().int().min(0),
  failed: z.number().int().min(0),
  delayed: z.number().int().min(0),
  paused: z.number().int().min(0),
  total: z.number().int().min(0),
});

export type QueueMetrics = z.infer<typeof QueueMetricsSchema>;

