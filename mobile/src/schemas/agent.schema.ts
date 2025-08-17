import { z } from 'zod';

// Agent item schema
export const AgentSchema = z.object({
  name: z.string().describe('Agent name from YAML frontmatter'),
  description: z.string().describe('Agent description from YAML frontmatter'),
  color: z.string().describe('Agent color from YAML frontmatter').optional(),
  content: z.string().describe('Main content of the agent file (after frontmatter)'),
  type: z
    .union([z.literal('user'), z.literal('project')])
    .describe('Agent type: user (from Claude home) or project (from repo)'),
});

// List agents response schema
export const ListAgentsResponseSchema = z.object({
  agents: z.array(AgentSchema),
  sources: z.object({
    userAgentsPath: z.string().describe('Path to user agents directory').optional(),
    projectAgentsPath: z.string().describe('Path to project agents directory').optional(),
  }),
});

// Query parameters for filtering agents
export const ListAgentsQuerySchema = z.object({
  type: z
    .union([z.literal('user'), z.literal('project'), z.literal('all')])
    .default('all')
    .describe('Filter agents by type')
    .optional(),
  search: z.string().describe('Search agents by name or description').optional(),
});

// Type exports
export type Agent = z.infer<typeof AgentSchema>;
export type ListAgentsResponse = z.infer<typeof ListAgentsResponseSchema>;
export type ListAgentsQuery = z.infer<typeof ListAgentsQuerySchema>;
