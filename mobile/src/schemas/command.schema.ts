import { z } from 'zod';

// Command item schema
export const CommandSchema = z.object({
  name: z.string().describe('Command name (filename without .md extension)'),
  body: z.string().describe('Contents of the command file'),
  type: z
    .union([z.literal('user'), z.literal('project')])
    .describe('Command type: user (from Claude home) or project (from repo)'),
});

// List commands response schema
export const ListCommandsResponseSchema = z.object({
  commands: z.array(CommandSchema),
  sources: z.object({
    userCommandsPath: z.string().describe('Path to user commands directory').optional(),
    projectCommandsPath: z.string().describe('Path to project commands directory').optional(),
  }),
});

// Query parameters for filtering commands
export const ListCommandsQuerySchema = z.object({
  type: z
    .union([z.literal('user'), z.literal('project'), z.literal('all')])
    .default('all')
    .describe('Filter commands by type')
    .optional(),
  search: z.string().describe('Search commands by name or content').optional(),
});

// Type exports
export type Command = z.infer<typeof CommandSchema>;
export type ListCommandsResponse = z.infer<typeof ListCommandsResponseSchema>;
export type ListCommandsQuery = z.infer<typeof ListCommandsQuerySchema>;
