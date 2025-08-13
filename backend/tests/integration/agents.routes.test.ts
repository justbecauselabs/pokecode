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

describe('Agents Routes', () => {
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

    // Mock the agent service
    vi.doMock('@/services/agent.service', () => {
      return {
        agentService: {
          listAgents: vi.fn(),
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

    // Reset agent service mock
    const { agentService } = await import('@/services/agent.service');
    vi.mocked(agentService.listAgents).mockReset();
  });

  describe('GET /sessions/:sessionId/agents', () => {
    it('should list agents successfully', async () => {
      const { agentService } = await import('@/services/agent.service');
      
      // Mock the agent service response
      const mockResponse = {
        agents: [
          {
            name: 'backend-expert',
            description: 'Expert in backend development with Fastify',
            color: 'blue',
            content: 'You are a backend development expert...',
            type: 'user' as const,
          },
          {
            name: 'frontend-guru',
            description: 'Expert in React Native and Expo',
            color: 'green',
            content: 'You are a frontend development expert...',
            type: 'project' as const,
          },
        ],
        sources: {
          userAgentsPath: '/home/user/.claude/agents',
          projectAgentsPath: '/test/project/.claude/agents',
        },
      };

      vi.mocked(agentService.listAgents).mockResolvedValueOnce(mockResponse);

      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/agents`
      );

      assertSuccessResponse(response, 200);

      const result = parseResponse(response);
      expect(result).toEqual(mockResponse);

      // Verify the service was called with correct parameters
      expect(agentService.listAgents).toHaveBeenCalledWith({
        sessionId: testSession.id,
        projectPath: testSession.projectPath,
        query: { type: 'all' },
      });
    });

    it('should filter agents by type', async () => {
      const { agentService } = await import('@/services/agent.service');
      
      const mockResponse = {
        agents: [
          {
            name: 'backend-expert',
            description: 'Expert in backend development with Fastify',
            color: 'blue',
            content: 'You are a backend development expert...',
            type: 'user' as const,
          },
        ],
        sources: {
          userAgentsPath: '/home/user/.claude/agents',
          projectAgentsPath: undefined,
        },
      };

      vi.mocked(agentService.listAgents).mockResolvedValueOnce(mockResponse);

      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/agents?type=user`
      );

      assertSuccessResponse(response, 200);

      const result = parseResponse(response);
      expect(result).toEqual(mockResponse);

      // Verify the service was called with correct query parameters
      expect(agentService.listAgents).toHaveBeenCalledWith({
        sessionId: testSession.id,
        projectPath: testSession.projectPath,
        query: { type: 'user' },
      });
    });

    it('should filter agents by search term', async () => {
      const { agentService } = await import('@/services/agent.service');
      
      const mockResponse = {
        agents: [
          {
            name: 'backend-expert',
            description: 'Expert in backend development with Fastify',
            color: 'blue',
            content: 'You are a backend development expert...',
            type: 'user' as const,
          },
        ],
        sources: {
          userAgentsPath: '/home/user/.claude/agents',
          projectAgentsPath: '/test/project/.claude/agents',
        },
      };

      vi.mocked(agentService.listAgents).mockResolvedValueOnce(mockResponse);

      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/agents?search=backend`
      );

      assertSuccessResponse(response, 200);

      const result = parseResponse(response);
      expect(result).toEqual(mockResponse);

      // Verify the service was called with correct query parameters
      expect(agentService.listAgents).toHaveBeenCalledWith({
        sessionId: testSession.id,
        projectPath: testSession.projectPath,
        query: { search: 'backend' },
      });
    });

    it('should combine type and search filters', async () => {
      const { agentService } = await import('@/services/agent.service');
      
      const mockResponse = {
        agents: [],
        sources: {
          userAgentsPath: '/home/user/.claude/agents',
          projectAgentsPath: '/test/project/.claude/agents',
        },
      };

      vi.mocked(agentService.listAgents).mockResolvedValueOnce(mockResponse);

      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/agents?type=project&search=nonexistent`
      );

      assertSuccessResponse(response, 200);

      const result = parseResponse(response);
      expect(result).toEqual(mockResponse);

      // Verify the service was called with both filters
      expect(agentService.listAgents).toHaveBeenCalledWith({
        sessionId: testSession.id,
        projectPath: testSession.projectPath,
        query: { type: 'project', search: 'nonexistent' },
      });
    });

    it('should return empty agents array when no agents found', async () => {
      const { agentService } = await import('@/services/agent.service');
      
      const mockResponse = {
        agents: [],
        sources: {
          userAgentsPath: undefined,
          projectAgentsPath: undefined,
        },
      };

      vi.mocked(agentService.listAgents).mockResolvedValueOnce(mockResponse);

      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/agents`
      );

      assertSuccessResponse(response, 200);

      const result = parseResponse(response);
      expect(result).toEqual(mockResponse);
    });

    it('should return 404 when session not found', async () => {
      const response = await makeRequest(
        app,
        'GET',
        '/sessions/00000000-0000-0000-0000-000000000000/agents'
      );

      assertErrorResponse(response, 404);
      
      const result = parseResponse(response);
      expect(result.error).toContain('not found');
    });

    it('should return 400 with invalid session ID format', async () => {
      const response = await makeRequest(
        app,
        'GET',
        '/sessions/invalid-uuid/agents'
      );

      assertErrorResponse(response, 400);
    });

    it('should handle service errors appropriately', async () => {
      const { agentService } = await import('@/services/agent.service');
      
      // Mock a validation error from the service
      const ValidationError = (await import('@/types')).ValidationError;
      vi.mocked(agentService.listAgents).mockRejectedValueOnce(
        new ValidationError('Invalid project path')
      );

      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/agents`
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
        `/sessions/${testSession.id}/agents?type=invalid`
      );

      assertErrorResponse(response1, 400);

      // Test valid parameters should work
      const { agentService } = await import('@/services/agent.service');
      
      const mockResponse = {
        agents: [],
        sources: {
          userAgentsPath: undefined,
          projectAgentsPath: undefined,
        },
      };

      vi.mocked(agentService.listAgents).mockResolvedValueOnce(mockResponse);

      const response2 = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/agents?type=all&search=test`
      );

      assertSuccessResponse(response2, 200);
    });

    it('should handle agents with missing optional fields', async () => {
      const { agentService } = await import('@/services/agent.service');
      
      // Mock response with agent missing color field
      const mockResponse = {
        agents: [
          {
            name: 'simple-agent',
            description: 'A simple agent without color',
            color: undefined,
            content: 'You are a simple agent.',
            type: 'project' as const,
          },
        ],
        sources: {
          projectAgentsPath: '/test/project/.claude/agents',
        },
      };

      vi.mocked(agentService.listAgents).mockResolvedValueOnce(mockResponse);

      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/agents`
      );

      assertSuccessResponse(response, 200);

      const result = parseResponse(response);
      expect(result).toEqual(mockResponse);
      expect(result.agents[0].color).toBeUndefined();
    });
  });
});