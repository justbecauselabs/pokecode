import type { ListRepositoriesResponse, RepositoryResponse } from '@pokecode/api';
import { getConfig } from '../config';
import { directoryExists, validateGitRepository } from '../utils/file';

export class RepositoryService {
  /**
   * List all git repositories from configured repository paths
   */
  async listRepositories(): Promise<ListRepositoriesResponse> {
    try {
      const config = await getConfig();
      const repositoryPaths = config.repositories;
      const repositories: RepositoryResponse[] = [];

      // Check each configured repository path
      for (const repoPath of repositoryPaths) {
        if (!(await directoryExists(repoPath))) {
          console.warn(`Repository path does not exist: ${repoPath}`);
          continue;
        }

        // Use the dedicated git validation method
        const { exists, isGitRepository } = await validateGitRepository(repoPath);

        if (exists) {
          // Extract folder name from path
          const folderName = repoPath.split('/').pop() || repoPath;

          repositories.push({
            folderName,
            path: repoPath,
            isGitRepository,
          });
        }
      }

      // Sort by folder name for consistent ordering
      repositories.sort((a, b) => a.folderName.localeCompare(b.folderName));

      return {
        repositories,
        total: repositories.length,
        githubReposDirectory: 'config.json repositories list',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read repositories: ${message}`);
    }
  }
}

export const repositoryService = new RepositoryService();
