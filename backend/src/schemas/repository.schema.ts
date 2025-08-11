import { type Static, Type } from '@sinclair/typebox';

// Repository response schema
export const RepositoryResponseSchema = Type.Object({
  folderName: Type.String({
    minLength: 1,
    description: 'The folder name of the repository',
  }),
  path: Type.String({
    description: 'The absolute path to the repository',
  }),
  isGitRepository: Type.Boolean({
    description: 'Whether the folder contains a .git directory',
  }),
});

// List repositories response schema
export const ListRepositoriesResponseSchema = Type.Object({
  repositories: Type.Array(RepositoryResponseSchema),
  total: Type.Integer(),
  githubReposDirectory: Type.String({
    description: 'The configured GITHUB_REPOS_DIRECTORY',
  }),
});

// Type exports
export type RepositoryResponse = Static<typeof RepositoryResponseSchema>;
export type ListRepositoriesResponse = Static<typeof ListRepositoriesResponseSchema>;
