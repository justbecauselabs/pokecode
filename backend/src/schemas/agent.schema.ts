import { type Static, Type } from '@sinclair/typebox';

// Agent item schema
export const AgentSchema = Type.Object({
  name: Type.String({ description: 'Agent name from YAML frontmatter' }),
  description: Type.String({ description: 'Agent description from YAML frontmatter' }),
  color: Type.Optional(Type.String({ description: 'Agent color from YAML frontmatter' })),
  content: Type.String({ description: 'Main content of the agent file (after frontmatter)' }),
  type: Type.Union([Type.Literal('user'), Type.Literal('project')], {
    description: 'Agent type: user (from Claude home) or project (from repo)',
  }),
});

// List agents response schema
export const ListAgentsResponseSchema = Type.Object({
  agents: Type.Array(AgentSchema),
  sources: Type.Object({
    userAgentsPath: Type.Optional(Type.String({ description: 'Path to user agents directory' })),
    projectAgentsPath: Type.Optional(
      Type.String({ description: 'Path to project agents directory' }),
    ),
  }),
});

// Query parameters for filtering agents
export const ListAgentsQuerySchema = Type.Object({
  type: Type.Optional(
    Type.Union([Type.Literal('user'), Type.Literal('project'), Type.Literal('all')], {
      default: 'all',
      description: 'Filter agents by type',
    }),
  ),
  search: Type.Optional(Type.String({ description: 'Search agents by name or description' })),
});

// Type exports
export type Agent = Static<typeof AgentSchema>;
export type ListAgentsResponse = Static<typeof ListAgentsResponseSchema>;
export type ListAgentsQuery = Static<typeof ListAgentsQuerySchema>;
