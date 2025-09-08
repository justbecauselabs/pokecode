import { z } from 'zod';

export const ToolConfigStatusSchema = z.object({
  configuredPath: z.string().nullable(),
  exists: z.boolean(),
  version: z.string().nullable(),
});

export const ConfigStatusSchema = z.object({
  claudeCode: ToolConfigStatusSchema,
  codexCli: ToolConfigStatusSchema,
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
});

export type ToolConfigStatus = z.infer<typeof ToolConfigStatusSchema>;
export type ConfigStatus = z.infer<typeof ConfigStatusSchema>;

