import { type Static, Type } from '@sinclair/typebox';

// Command item schema
export const CommandSchema = Type.Object({
  name: Type.String({ description: 'Command name (filename without .md extension)' }),
  body: Type.String({ description: 'Contents of the command file' }),
  type: Type.Union([Type.Literal('user'), Type.Literal('project')], {
    description: 'Command type: user (from Claude home) or project (from repo)',
  }),
});

// List commands response schema
export const ListCommandsResponseSchema = Type.Object({
  commands: Type.Array(CommandSchema),
  sources: Type.Object({
    userCommandsPath: Type.Optional(
      Type.String({ description: 'Path to user commands directory' }),
    ),
    projectCommandsPath: Type.Optional(
      Type.String({ description: 'Path to project commands directory' }),
    ),
  }),
});

// Query parameters for filtering commands
export const ListCommandsQuerySchema = Type.Object({
  type: Type.Optional(
    Type.Union([Type.Literal('user'), Type.Literal('project'), Type.Literal('all')], {
      default: 'all',
      description: 'Filter commands by type',
    }),
  ),
  search: Type.Optional(Type.String({ description: 'Search commands by name or content' })),
});

// Type exports
export type Command = Static<typeof CommandSchema>;
export type ListCommandsResponse = Static<typeof ListCommandsResponseSchema>;
export type ListCommandsQuery = Static<typeof ListCommandsQuerySchema>;
