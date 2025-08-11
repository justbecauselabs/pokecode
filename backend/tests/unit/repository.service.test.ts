import { describe, it, expect, beforeAll, mock, afterAll } from 'bun:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { RepositoryService } from '@/services/repository.service';

describe('RepositoryService', () => {
  let service: RepositoryService;
  const mockGithubReposDir = '/test/repos';

  beforeAll(() => {
    // Mock the config to use a test directory
    mock.module('@/config', () => ({
      config: {
        GITHUB_REPOS_DIRECTORY: mockGithubReposDir,
      },
    }));
    
    service = new RepositoryService();
  });

  afterAll(() => {
    mock.restore();
  });

  describe('resolveFolderPath', () => {
    it('should resolve folder name to absolute path', () => {
      const result = service.resolveFolderPath('test-repo');
      expect(result).toBe(path.join(mockGithubReposDir, 'test-repo'));
    });

    it('should throw error for empty folder name', () => {
      expect(() => service.resolveFolderPath('')).toThrow('Folder name is required');
    });

    it('should throw error for folder name with path separators', () => {
      expect(() => service.resolveFolderPath('folder/with/slash')).toThrow(
        'Invalid folder name: cannot contain path separators or traversal'
      );
    });

    it('should throw error for folder name with traversal', () => {
      expect(() => service.resolveFolderPath('../traversal')).toThrow(
        'Invalid folder name: cannot contain path separators or traversal'
      );
    });

    it('should throw error for non-string folder name', () => {
      expect(() => service.resolveFolderPath(null as any)).toThrow('Folder name is required');
    });
  });

  describe('validateRepository', () => {
    it('should return false for non-existent folder', async () => {
      // Mock fs.stat to throw for non-existent path
      const originalStat = fs.stat;
      fs.stat = mock(() => Promise.reject(new Error('ENOENT'))) as any;

      const result = await service.validateRepository('non-existent');
      expect(result).toEqual({ exists: false, isGitRepository: false });

      fs.stat = originalStat;
    });

    it('should return exists: true, isGitRepository: false for folder without .git', async () => {
      // Mock fs.stat to return directory for main folder but fail for .git
      const originalStat = fs.stat;
      fs.stat = mock((path: string) => {
        if (path.endsWith('test-repo')) {
          return Promise.resolve({ isDirectory: () => true });
        }
        if (path.endsWith('.git')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.reject(new Error('ENOENT'));
      }) as any;

      const result = await service.validateRepository('test-repo');
      expect(result).toEqual({ exists: true, isGitRepository: false });

      fs.stat = originalStat;
    });

    it('should return exists: true, isGitRepository: true for git repository', async () => {
      // Mock fs.stat to return directory for both main folder and .git
      const originalStat = fs.stat;
      fs.stat = mock(() => Promise.resolve({ isDirectory: () => true })) as any;

      const result = await service.validateRepository('git-repo');
      expect(result).toEqual({ exists: true, isGitRepository: true });

      fs.stat = originalStat;
    });
  });

  describe('listRepositories', () => {
    it('should list repositories and detect git status', async () => {
      // Mock fs.readdir to return test directories
      const originalReaddir = fs.readdir;
      const originalStat = fs.stat;

      fs.readdir = mock(() => Promise.resolve([
        { name: 'git-repo', isDirectory: () => true },
        { name: 'regular-folder', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false },
      ])) as any;

      fs.stat = mock((path: string) => {
        if (path.endsWith('git-repo/.git')) {
          return Promise.resolve({ isDirectory: () => true });
        }
        if (path.endsWith('regular-folder/.git')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve({ isDirectory: () => true });
      }) as any;

      const result = await service.listRepositories();

      expect(result.total).toBe(2);
      expect(result.githubReposDirectory).toBe(mockGithubReposDir);
      expect(result.repositories).toHaveLength(2);
      
      // Should be sorted by folder name
      expect(result.repositories[0].folderName).toBe('git-repo');
      expect(result.repositories[0].isGitRepository).toBe(true);
      
      expect(result.repositories[1].folderName).toBe('regular-folder');
      expect(result.repositories[1].isGitRepository).toBe(false);

      fs.readdir = originalReaddir;
      fs.stat = originalStat;
    });

    it('should handle errors when reading repositories directory', async () => {
      // Mock fs.readdir to throw error
      const originalReaddir = fs.readdir;
      fs.readdir = mock(() => Promise.reject(new Error('Permission denied'))) as any;

      await expect(service.listRepositories()).rejects.toThrow(
        'Failed to read repositories directory: Permission denied'
      );

      fs.readdir = originalReaddir;
    });
  });
});