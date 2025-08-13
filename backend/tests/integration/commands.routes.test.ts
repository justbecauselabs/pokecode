import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import {
  createTestApp,
  cleanupTestApp,
  makeRequest,
  parseResponse,
  assertSuccessResponse,
  assertErrorResponse,
} from '../helpers/fastify.helpers';
import { createTestSession } from '../helpers/database.helpers';
import { createMockClaudeDirectoryService, mockClaudeDirectoryModule } from '../helpers/claude-directory.mock';
import * as schema from '@/db/schema';

describe('Commands Routes', () => {
  let app: FastifyInstance;
  let testSession: typeof schema.sessions.$inferSelect;
  let mockClaudeService: ReturnType<typeof createMockClaudeDirectoryService>;

  beforeAll(async () => {
    // Set up mocks before creating app
    mockClaudeService = createMockClaudeDirectoryService();
    mockClaudeDirectoryModule(mockClaudeService);

    // Mock repository service
    vi.doMock('@/services/repository.service', () => ({
      repositoryService: {
        resolveFolderPath: vi.fn((folderName: string) => `/test/repos/${folderName}`),
        validateRepository: vi.fn(() => 
          Promise.resolve({ exists: true, isGitRepository: true })
        ),
      }
    }));

    // Mock the command service with real file system operations
    vi.doMock('@/services/command.service', () => {
      return {
        commandService: {
          listCommands: vi.fn(),
        },
      };
    });

    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestApp(app);
  });

  beforeEach(async () => {
    mockClaudeService._clearMockData();
    
    // Create a test session for each test
    testSession = await createTestSession({
      projectPath: '/test/project',
    });

    // Reset command service mock
    const { commandService } = await import('@/services/command.service');
    vi.mocked(commandService.listCommands).mockReset();
  });

  describe('GET /sessions/:sessionId/commands', () => {
    it('should list commands successfully', async () => {
      const { commandService } = await import('@/services/command.service');
      
      // Mock the command service response
      const mockResponse = {
        commands: [
          {
            name: 'deploy',
            body: '# Deploy Command\nDeploy the application',
            type: 'user' as const,
          },
          {
            name: 'test',
            body: '# Test Command\nRun tests',
            type: 'project' as const,
          },
        ],
        sources: {
          userCommandsPath: '/home/user/.claude/commands',
          projectCommandsPath: '/test/project/commands',
        },
      };

      vi.mocked(commandService.listCommands).mockResolvedValueOnce(mockResponse);

      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/commands`
      );

      assertSuccessResponse(response, 200);

      const result = parseResponse(response);
      expect(result).toEqual(mockResponse);

      // Verify the service was called with correct parameters
      expect(commandService.listCommands).toHaveBeenCalledWith({
        sessionId: testSession.id,
        projectPath: testSession.projectPath,
        query: { type: 'all' },
      });
    });

    it('should filter commands by type', async () => {
      const { commandService } = await import('@/services/command.service');
      
      const mockResponse = {
        commands: [
          {
            name: 'deploy',
            body: '# Deploy Command\nDeploy the application',
            type: 'user' as const,
          },
        ],
        sources: {
          userCommandsPath: '/home/user/.claude/commands',
          projectCommandsPath: undefined,
        },
      };

      vi.mocked(commandService.listCommands).mockResolvedValueOnce(mockResponse);

      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/commands?type=user`
      );

      assertSuccessResponse(response, 200);

      const result = parseResponse(response);
      expect(result).toEqual(mockResponse);

      // Verify the service was called with correct query parameters
      expect(commandService.listCommands).toHaveBeenCalledWith({
        sessionId: testSession.id,
        projectPath: testSession.projectPath,
        query: { type: 'user' },
      });
    });

    it('should filter commands by search term', async () => {
      const { commandService } = await import('@/services/command.service');
      
      const mockResponse = {
        commands: [
          {
            name: 'deploy',
            body: '# Deploy Command\nDeploy the application',
            type: 'user' as const,
          },
        ],
        sources: {
          userCommandsPath: '/home/user/.claude/commands',
          projectCommandsPath: '/test/project/commands',
        },
      };

      vi.mocked(commandService.listCommands).mockResolvedValueOnce(mockResponse);

      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/commands?search=deploy`
      );

      assertSuccessResponse(response, 200);

      const result = parseResponse(response);
      expect(result).toEqual(mockResponse);

      // Verify the service was called with correct query parameters
      expect(commandService.listCommands).toHaveBeenCalledWith({
        sessionId: testSession.id,
        projectPath: testSession.projectPath,
        query: { search: 'deploy' },
      });
    });

    it('should combine type and search filters', async () => {
      const { commandService } = await import('@/services/command.service');
      
      const mockResponse = {
        commands: [],
        sources: {
          userCommandsPath: '/home/user/.claude/commands',
          projectCommandsPath: '/test/project/commands',
        },
      };

      vi.mocked(commandService.listCommands).mockResolvedValueOnce(mockResponse);

      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/commands?type=project&search=nonexistent`
      );

      assertSuccessResponse(response, 200);

      const result = parseResponse(response);
      expect(result).toEqual(mockResponse);

      // Verify the service was called with both filters
      expect(commandService.listCommands).toHaveBeenCalledWith({
        sessionId: testSession.id,
        projectPath: testSession.projectPath,
        query: { type: 'project', search: 'nonexistent' },
      });
    });

    it('should return empty commands array when no commands found', async () => {
      const { commandService } = await import('@/services/command.service');
      
      const mockResponse = {
        commands: [],
        sources: {
          userCommandsPath: undefined,
          projectCommandsPath: undefined,
        },
      };

      vi.mocked(commandService.listCommands).mockResolvedValueOnce(mockResponse);

      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/commands`
      );

      assertSuccessResponse(response, 200);

      const result = parseResponse(response);
      expect(result).toEqual(mockResponse);
    });

    it('should return 404 when session not found', async () => {
      const response = await makeRequest(
        app,
        'GET',
        '/sessions/00000000-0000-0000-0000-000000000000/commands'
      );

      assertErrorResponse(response, 404);
      
      const result = parseResponse(response);
      expect(result.error).toContain('not found');
    });

    it('should return 400 with invalid session ID format', async () => {
      const response = await makeRequest(
        app,
        'GET',
        '/sessions/invalid-uuid/commands'
      );

      assertErrorResponse(response, 400);
    });

    it('should handle service errors appropriately', async () => {
      const { commandService } = await import('@/services/command.service');
      
      // Mock a validation error from the service
      const ValidationError = (await import('@/types')).ValidationError;
      vi.mocked(commandService.listCommands).mockRejectedValueOnce(
        new ValidationError('Invalid project path')
      );

      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/commands`
      );

      assertErrorResponse(response, 400);
      
      const result = parseResponse(response);
      expect(result.error).toBe('Invalid project path');
    });

    it('should validate query parameters', async () => {
      // Test invalid type parameter
      const response1 = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/commands?type=invalid`
      );

      assertErrorResponse(response1, 400);

      // Test valid parameters should work
      const { commandService } = await import('@/services/command.service');
      
      const mockResponse = {
        commands: [],
        sources: {
          userCommandsPath: undefined,
          projectCommandsPath: undefined,
        },
      };

      vi.mocked(commandService.listCommands).mockResolvedValueOnce(mockResponse);

      const response2 = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/commands?type=all&search=test`
      );

      assertSuccessResponse(response2, 200);
    });
  });
});