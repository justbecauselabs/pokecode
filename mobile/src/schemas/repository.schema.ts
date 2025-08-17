import { z } from 'zod';

// Repository response schema
export const RepositoryResponseSchema = z.object({
  folderName: z.string().min(1).describe('The folder name of the repository'),
  path: z.string().describe('The absolute path to the repository'),
  isGitRepository: z.boolean().describe('Whether the folder contains a .git directory'),
});

// List repositories response schema
export const ListRepositoriesResponseSchema = z.object({
  repositories: z.array(RepositoryResponseSchema),
  total: z.number().int(),
  githubReposDirectory: z.string().describe('The configured GITHUB_REPOS_DIRECTORY'),
});

// Type exports
export type RepositoryResponse = z.infer<typeof RepositoryResponseSchema>;
export type ListRepositoriesResponse = z.infer<typeof ListRepositoriesResponseSchema>;
