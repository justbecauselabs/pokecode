import type { ListRepositoriesResponse, RepositoryResponse } from '@pokecode/api';
import { config } from '@/config';
import { directoryExists, joinPath, listDirectory, validateGitRepository } from '@/utils/file';

export class RepositoryService {
  /**
   * List all git repositories in the GITHUB_REPOS_DIRECTORY using File Service
   */
  async listRepositories(): Promise<ListRepositoriesResponse> {
    const githubReposDirectory = config.GITHUB_REPOS_DIRECTORY;

    try {
      // Check if the github repos directory exists
      if (!(await directoryExists(githubReposDirectory))) {
        throw new Error(`Directory does not exist: ${githubReposDirectory}`);
      }

      // Use File Utils to list directory contents
      const items = await listDirectory(githubReposDirectory, {
        includeHidden: false,
      });

      // Filter for directories only
      const directories = items.filter((item) => item.isDirectory);

      const repositories: RepositoryResponse[] = [];

      // Check each directory for git repository status
      for (const dir of directories) {
        const folderPath = joinPath(githubReposDirectory, dir.name);

        // Use the dedicated git validation method
        const { exists, isGitRepository } = await validateGitRepository(folderPath);

        if (exists) {
          repositories.push({
            folderName: dir.name,
            path: folderPath,
            isGitRepository,
          });
        }
      }

      // Sort by folder name for consistent ordering
      repositories.sort((a, b) => a.folderName.localeCompare(b.folderName));

      return {
        repositories,
        total: repositories.length,
        githubReposDirectory,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read repositories directory: ${message}`);
    }
  }

  /**
   * Resolve a folder name to an absolute path within GITHUB_REPOS_DIRECTORY
   */
  resolveFolderPath(folderName: string): string {
    if (!folderName || typeof folderName !== 'string') {
      throw new Error('Folder name is required');
    }

    // Basic validation to prevent path traversal
    if (folderName.includes('..') || folderName.includes('/') || folderName.includes('\\')) {
      throw new Error('Invalid folder name: cannot contain path separators or traversal');
    }

    return joinPath(config.GITHUB_REPOS_DIRECTORY, folderName);
  }

  /**
   * Check if a folder exists and is a git repository using File Service
   */
  async validateRepository(
    folderName: string,
  ): Promise<{ exists: boolean; isGitRepository: boolean }> {
    try {
      const folderPath = this.resolveFolderPath(folderName);
      return await validateGitRepository(folderPath);
    } catch (error) {
      // Log validation error but don't throw, just return false
      console.error(`Repository validation error for ${folderName}:`, error);
      return { exists: false, isGitRepository: false };
    }
  }
}

export const repositoryService = new RepositoryService();
