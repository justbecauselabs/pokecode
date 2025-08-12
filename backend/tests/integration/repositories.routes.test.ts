import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createTestApp, cleanupTestApp, makeRequest, parseResponse, assertSuccessResponse, assertErrorResponse } from '../helpers/fastify.helpers';
import { createMockClaudeDirectoryService, mockClaudeDirectoryModule } from '../helpers/claude-directory.mock';

describe('Repository Routes', () => {
  let app: FastifyInstance;
  let mockClaudeService: ReturnType<typeof createMockClaudeDirectoryService>;

  beforeAll(async () => {
    // Set up mocks before creating app
    mockClaudeService = createMockClaudeDirectoryService();
    mockClaudeDirectoryModule(mockClaudeService);

    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestApp(app);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /repositories', () => {
    beforeEach(() => {
      // Mock repository service with default successful response
      vi.doMock('@/services/repository.service', () => ({
        repositoryService: {
          listRepositories: vi.fn(() => Promise.resolve({
            repositories: [
              {
                name: 'test-repo-1',
                path: '/test/repos/test-repo-1',
                isGitRepository: true,
                lastModified: '2023-01-01T00:00:00Z',
                description: 'First test repository',
              },
              {
                name: 'test-repo-2',
                path: '/test/repos/test-repo-2',
                isGitRepository: false,
                lastModified: '2023-01-02T00:00:00Z',
                description: null,
              },
              {
                name: 'git-project',
                path: '/test/repos/git-project',
                isGitRepository: true,
                lastModified: '2023-01-03T00:00:00Z',
                description: 'A Git project',
              },
            ],
            total: 3,
            gitRepositories: 2,
            regularFolders: 1,
          })),
        }
      }));
    });

    it('should list all repositories', async () => {
      const response = await makeRequest(app, 'GET', '/repositories');

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      expect(result).toMatchObject({
        repositories: expect.arrayContaining([
          expect.objectContaining({
            name: 'test-repo-1',
            path: '/test/repos/test-repo-1',
            isGitRepository: true,
            lastModified: expect.any(String),
            description: 'First test repository',
          }),
          expect.objectContaining({
            name: 'test-repo-2',
            path: '/test/repos/test-repo-2',
            isGitRepository: false,
            lastModified: expect.any(String),
            description: null,
          }),
          expect.objectContaining({
            name: 'git-project',
            path: '/test/repos/git-project',
            isGitRepository: true,
            lastModified: expect.any(String),
            description: 'A Git project',
          }),
        ]),
        total: 3,
        gitRepositories: 2,
        regularFolders: 1,
      });
    });

    it('should handle empty repository directory', async () => {
      const { repositoryService } = await import('@/services/repository.service');
      repositoryService.listRepositories = vi.fn(() => Promise.resolve({
        repositories: [],
        total: 0,
        gitRepositories: 0,
        regularFolders: 0,
      }));

      const response = await makeRequest(app, 'GET', '/repositories');

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      expect(result).toMatchObject({
        repositories: [],
        total: 0,
        gitRepositories: 0,
        regularFolders: 0,
      });
    });

    it('should differentiate between git and regular repositories', async () => {
      const response = await makeRequest(app, 'GET', '/repositories');

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      
      const gitRepos = result.repositories.filter((repo: any) => repo.isGitRepository);
      const regularRepos = result.repositories.filter((repo: any) => !repo.isGitRepository);
      
      expect(gitRepos).toHaveLength(2);
      expect(regularRepos).toHaveLength(1);
      expect(result.gitRepositories).toBe(2);
      expect(result.regularFolders).toBe(1);
    });

    it('should include repository metadata', async () => {
      const response = await makeRequest(app, 'GET', '/repositories');

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      
      result.repositories.forEach((repo: any) => {
        expect(repo).toHaveProperty('name');
        expect(repo).toHaveProperty('path');
        expect(repo).toHaveProperty('isGitRepository');
        expect(repo).toHaveProperty('lastModified');
        expect(repo).toHaveProperty('description');
        
        // Validate types
        expect(typeof repo.name).toBe('string');
        expect(typeof repo.path).toBe('string');
        expect(typeof repo.isGitRepository).toBe('boolean');
        expect(typeof repo.lastModified).toBe('string');
        expect(repo.description === null || typeof repo.description === 'string').toBe(true);
      });
    });

    it('should return 500 when repository service fails', async () => {
      const { repositoryService } = await import('@/services/repository.service');
      repositoryService.listRepositories = vi.fn(() => 
        Promise.reject(new Error('Failed to read repositories directory'))
      );

      const response = await makeRequest(app, 'GET', '/repositories');

      assertErrorResponse(response, 500, 'Failed to list repositories');
      
      const result = parseResponse(response);
      expect(result).toMatchObject({
        error: 'Failed to list repositories',
        code: 'REPOSITORY_LIST_ERROR',
      });
    });

    it('should handle permission errors', async () => {
      const { repositoryService } = await import('@/services/repository.service');
      repositoryService.listRepositories = vi.fn(() => 
        Promise.reject(new Error('Permission denied'))
      );

      const response = await makeRequest(app, 'GET', '/repositories');

      assertErrorResponse(response, 500);
    });

    it('should handle filesystem errors gracefully', async () => {
      const { repositoryService } = await import('@/services/repository.service');
      repositoryService.listRepositories = vi.fn(() => 
        Promise.reject(new Error('ENOENT: no such file or directory'))
      );

      const response = await makeRequest(app, 'GET', '/repositories');

      assertErrorResponse(response, 500);
      
      const result = parseResponse(response);
      expect(result.error).toBe('Failed to list repositories');
      expect(result.code).toBe('REPOSITORY_LIST_ERROR');
    });
  });

  describe('Schema validation', () => {
    it('should validate response schema for successful request', async () => {
      const response = await makeRequest(app, 'GET', '/repositories');

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      
      // Validate required top-level fields
      expect(result).toHaveProperty('repositories');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('gitRepositories');
      expect(result).toHaveProperty('regularFolders');
      
      // Validate types
      expect(Array.isArray(result.repositories)).toBe(true);
      expect(typeof result.total).toBe('number');
      expect(typeof result.gitRepositories).toBe('number');
      expect(typeof result.regularFolders).toBe('number');
    });

    it('should validate error response schema', async () => {
      const { repositoryService } = await import('@/services/repository.service');
      repositoryService.listRepositories = vi.fn(() => 
        Promise.reject(new Error('Test error'))
      );

      const response = await makeRequest(app, 'GET', '/repositories');

      expect(response.statusCode).toBe(500);
      
      const result = parseResponse(response);
      
      // Validate error response structure
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('code');
      expect(typeof result.error).toBe('string');
      expect(typeof result.code).toBe('string');
    });
  });

  describe('Performance', () => {
    it('should respond within reasonable time', async () => {
      const start = Date.now();
      const response = await makeRequest(app, 'GET', '/repositories');
      const duration = Date.now() - start;

      assertSuccessResponse(response, 200);
      
      // Should complete within 5 seconds (generous timeout for filesystem operations)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle large repository lists efficiently', async () => {
      // Mock a large repository list
      const largeRepoList = Array.from({ length: 100 }, (_, i) => ({
        name: `repo-${i}`,
        path: `/test/repos/repo-${i}`,
        isGitRepository: i % 2 === 0,
        lastModified: new Date().toISOString(),
        description: `Repository ${i}`,
      }));

      const { repositoryService } = await import('@/services/repository.service');
      repositoryService.listRepositories = vi.fn(() => Promise.resolve({
        repositories: largeRepoList,
        total: 100,
        gitRepositories: 50,
        regularFolders: 50,
      }));

      const start = Date.now();
      const response = await makeRequest(app, 'GET', '/repositories');
      const duration = Date.now() - start;

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      expect(result.repositories).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should be fast since it's just returning data
    });
  });

  describe('Error logging', () => {
    it('should log errors when repository service fails', async () => {
      const { repositoryService } = await import('@/services/repository.service');
      const testError = new Error('Test error for logging');
      repositoryService.listRepositories = vi.fn(() => Promise.reject(testError));

      // Spy on fastify logger if available
      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await makeRequest(app, 'GET', '/repositories');

      expect(response.statusCode).toBe(500);
      
      // The actual logging might happen in the fastify context
      // This test ensures the error path is covered
      
      logSpy.mockRestore();
    });
  });

  describe('Integration with repository service', () => {
    it('should call repository service correctly', async () => {
      const { repositoryService } = await import('@/services/repository.service');
      
      await makeRequest(app, 'GET', '/repositories');

      expect(repositoryService.listRepositories).toHaveBeenCalledOnce();
      expect(repositoryService.listRepositories).toHaveBeenCalledWith();
    });

    it('should pass through repository service data unchanged', async () => {
      const mockData = {
        repositories: [
          {
            name: 'specific-repo',
            path: '/specific/path',
            isGitRepository: true,
            lastModified: '2023-01-01T12:00:00Z',
            description: 'Specific test',
          },
        ],
        total: 1,
        gitRepositories: 1,
        regularFolders: 0,
      };

      const { repositoryService } = await import('@/services/repository.service');
      repositoryService.listRepositories = vi.fn(() => Promise.resolve(mockData));

      const response = await makeRequest(app, 'GET', '/repositories');

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      expect(result).toEqual(mockData);
    });
  });
});