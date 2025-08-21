import type { ListRepositoriesResponse, RepositoryResponse } from '@pokecode/api';
import { getRepositoryPaths } from '@/utils/env';
import { directoryExists, validateGitRepository } from '@/utils/file';

export class RepositoryService {
  /**
   * List all git repositories from configured repository paths
   */
  async listRepositories(): Promise<ListRepositoriesResponse> {
    try {
      const repositoryPaths = await getRepositoryPaths();
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
        githubReposDirectory: '~/.pokecode/config.json repositories list',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read repositories: ${message}`);
    }
  }

  /**
   * Resolve a folder name to an absolute path from configured repositories
   */
  async resolveFolderPath(folderName: string): Promise<string> {
    if (!folderName || typeof folderName !== 'string') {
      throw new Error('Folder name is required');
    }

    const repositoryPaths = await getRepositoryPaths();

    // Find the repository path that ends with this folder name
    const matchingPath = repositoryPaths.find((path) => {
      const pathFolderName = path.split('/').pop();
      return pathFolderName === folderName;
    });

    if (!matchingPath) {
      throw new Error(`Repository folder '${folderName}' not found in configured repositories`);
    }

    return matchingPath;
  }

  /**
   * Check if a folder exists and is a git repository using File Service
   */
  async validateRepository(
    folderName: string,
  ): Promise<{ exists: boolean; isGitRepository: boolean }> {
    try {
      const folderPath = await this.resolveFolderPath(folderName);
      return await validateGitRepository(folderPath);
    } catch (error) {
      // Log validation error but don't throw, just return false
      console.error(`Repository validation error for ${folderName}:`, error);
      return { exists: false, isGitRepository: false };
    }
  }
}

export const repositoryService = new RepositoryService();
