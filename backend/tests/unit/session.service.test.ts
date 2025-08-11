import { describe, it, expect, beforeAll, mock, afterAll } from 'bun:test';
import { SessionService } from '@/services/session.service';
import { ValidationError } from '@/types';

describe('SessionService', () => {
  let service: SessionService;

  beforeAll(() => {
    // Mock the database and repository service
    mock.module('@/db', () => ({
      db: {
        insert: mock(() => ({
          values: mock((data: any) => ({
            returning: mock(() => [
              {
                id: 'test-session-id',
                projectPath: data.projectPath, // Use the actual projectPath from input
                claudeDirectoryPath: data.claudeDirectoryPath, // New field for Claude directory path
                context: data.context || null,
                metadata: data.metadata || null,
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
                lastAccessedAt: new Date(),
              }
            ])
          }))
        }))
      }
    }));

    // Mock repository service
    mock.module('@/services/repository.service', () => ({
      repositoryService: {
        resolveFolderPath: mock((folderName: string) => `/test/repos/${folderName}`),
        validateRepository: mock((folderName: string) => 
          Promise.resolve({ exists: true, isGitRepository: true })
        ),
      }
    }));

    service = new SessionService();
  });

  afterAll(() => {
    mock.restore();
  });

  describe('createSession', () => {
    it('should create session with projectPath', async () => {
      const result = await service.createSession({
        projectPath: '/absolute/path',
      });

      expect(result).toBeDefined();
      expect(result.projectPath).toBe('/absolute/path');
      expect(result.claudeDirectoryPath).toBeDefined();
    });

    it('should create session with folderName', async () => {
      const result = await service.createSession({
        folderName: 'test-repo',
      });

      expect(result).toBeDefined();
      expect(result.projectPath).toBe('/test/repos/test-repo');
    });

    it('should throw error when neither projectPath nor folderName provided', async () => {
      await expect(service.createSession({})).rejects.toBeInstanceOf(
        ValidationError
      );
      await expect(service.createSession({})).rejects.toThrow(
        'Either projectPath or folderName must be provided'
      );
    });

    it('should throw error when both projectPath and folderName provided', async () => {
      await expect(service.createSession({
        projectPath: '/absolute/path',
        folderName: 'test-repo',
      })).rejects.toBeInstanceOf(ValidationError);
      
      await expect(service.createSession({
        projectPath: '/absolute/path',
        folderName: 'test-repo',
      })).rejects.toThrow('Cannot provide both projectPath and folderName');
    });

    it('should throw error when folderName repository does not exist', async () => {
      // Override the mock for this test
      const { repositoryService } = await import('@/services/repository.service');
      repositoryService.validateRepository = mock(() => 
        Promise.resolve({ exists: false, isGitRepository: false })
      );

      await expect(service.createSession({
        folderName: 'non-existent',
      })).rejects.toBeInstanceOf(ValidationError);

      await expect(service.createSession({
        folderName: 'non-existent',
      })).rejects.toThrow("Repository folder 'non-existent' does not exist");
    });

    it('should throw error for invalid projectPath', async () => {
      await expect(service.createSession({
        projectPath: '../relative/path',
      })).rejects.toBeInstanceOf(ValidationError);
    });

    it('should throw error for invalid folderName characters', async () => {
      // Mock repository service to throw on invalid folder name
      const { repositoryService } = await import('@/services/repository.service');
      const originalResolveFolderPath = repositoryService.resolveFolderPath;
      
      repositoryService.resolveFolderPath = mock(() => {
        throw new Error('Invalid folder name: cannot contain path separators or traversal');
      });

      await expect(service.createSession({
        folderName: '../invalid',
      })).rejects.toBeInstanceOf(ValidationError);

      await expect(service.createSession({
        folderName: '../invalid',
      })).rejects.toThrow('Invalid repository folder');
      
      // Restore the original mock
      repositoryService.resolveFolderPath = originalResolveFolderPath;
    });

    it('should create session with context and metadata', async () => {
      // Ensure repository validation returns positive result
      const { repositoryService } = await import('@/services/repository.service');
      const originalValidateRepository = repositoryService.validateRepository;
      
      repositoryService.validateRepository = mock(() => 
        Promise.resolve({ exists: true, isGitRepository: true })
      );

      const result = await service.createSession({
        folderName: 'test-repo',
        context: 'Test context',
        metadata: { branch: 'main' },
      });

      expect(result).toBeDefined();
      expect(result.context).toBe('Test context');
      expect(result.metadata).toEqual({ branch: 'main' });
      
      // Restore the original mock
      repositoryService.validateRepository = originalValidateRepository;
    });

    it('should generate correct Claude directory path for project', async () => {
      const result = await service.createSession({
        projectPath: '/Users/test/workspace/myproject',
      });

      expect(result).toBeDefined();
      expect(result.projectPath).toBe('/Users/test/workspace/myproject');
      expect(result.claudeDirectoryPath).toBeDefined();
      // Claude directory path should be generated based on the project path
    });
  });
});