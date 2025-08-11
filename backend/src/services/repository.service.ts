import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from '@/config';
import type { ListRepositoriesResponse, RepositoryResponse } from '@/schemas/repository.schema';

export class RepositoryService {
  /**
   * List all git repositories in the GITHUB_REPOS_DIRECTORY
   */
  async listRepositories(): Promise<ListRepositoriesResponse> {
    const githubReposDirectory = config.GITHUB_REPOS_DIRECTORY;

    try {
      // Read all items in the directory
      const items = await fs.readdir(githubReposDirectory, { withFileTypes: true });

      // Filter for directories only
      const directories = items.filter((item) => item.isDirectory());

      const repositories: RepositoryResponse[] = [];

      // Check each directory for a .git folder
      for (const dir of directories) {
        const folderPath = path.join(githubReposDirectory, dir.name);
        const gitPath = path.join(folderPath, '.git');

        try {
          // Check if .git exists and is a directory
          const gitStat = await fs.stat(gitPath);
          const isGitRepository = gitStat.isDirectory();

          repositories.push({
            folderName: dir.name,
            path: folderPath,
            isGitRepository,
          });
        } catch (_error) {
          // .git doesn't exist, but still include the folder
          repositories.push({
            folderName: dir.name,
            path: folderPath,
            isGitRepository: false,
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
    } catch (error: any) {
      throw new Error(`Failed to read repositories directory: ${error.message}`);
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

    return path.join(config.GITHUB_REPOS_DIRECTORY, folderName);
  }

  /**
   * Check if a folder exists and is a git repository
   */
  async validateRepository(
    folderName: string,
  ): Promise<{ exists: boolean; isGitRepository: boolean }> {
    try {
      const folderPath = this.resolveFolderPath(folderName);
      const gitPath = path.join(folderPath, '.git');

      // Check if folder exists
      const folderStat = await fs.stat(folderPath);
      if (!folderStat.isDirectory()) {
        return { exists: false, isGitRepository: false };
      }

      // Check if .git exists
      try {
        const gitStat = await fs.stat(gitPath);
        return {
          exists: true,
          isGitRepository: gitStat.isDirectory(),
        };
      } catch {
        return { exists: true, isGitRepository: false };
      }
    } catch {
      return { exists: false, isGitRepository: false };
    }
  }
}

export const repositoryService = new RepositoryService();
