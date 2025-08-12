import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createTestApp, cleanupTestApp, makeRequest, parseResponse, assertSuccessResponse, assertErrorResponse, generateTestId } from '../helpers/fastify.helpers';
import { createTestSession } from '../helpers/database.helpers';
import { createMockClaudeDirectoryService, mockClaudeDirectoryModule } from '../helpers/claude-directory.mock';
import * as schema from '@/db/schema';

describe('Prompt Routes', () => {
  let app: FastifyInstance;
  let mockClaudeService: ReturnType<typeof createMockClaudeDirectoryService>;
  let testSession: typeof schema.sessions.$inferSelect;

  beforeAll(async () => {
    // Set up mocks before creating app
    mockClaudeService = createMockClaudeDirectoryService();
    mockClaudeDirectoryModule(mockClaudeService);

    // Mock queue service
    vi.doMock('@/services/queue.service', () => ({
      queueService: {
        addPromptJob: vi.fn(() => Promise.resolve('job-123')),
        cancelJob: vi.fn(() => Promise.resolve()),
        getJobStatus: vi.fn(() => Promise.resolve({
          id: 'job-123',
          state: 'completed',
          progress: 100,
        })),
      }
    }));

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
      claudeDirectoryPath: '/test/claude/session',
    });
  });

  describe('POST /sessions/:sessionId/prompts', () => {
    it('should create a new prompt', async () => {
      const promptData = {
        prompt: 'Write a hello world function in TypeScript',
        allowedTools: ['read', 'write'],
      };

      const response = await makeRequest(
        app,
        'POST',
        `/sessions/${testSession.id}/prompts`,
        promptData
      );

      assertSuccessResponse(response, 201);
      
      const result = parseResponse(response);
      expect(result).toMatchObject({
        id: expect.any(String),
        sessionId: testSession.id,
        message: 'Prompt queued successfully',
        jobId: 'job-123',
        status: 'queued',
        queuePosition: expect.any(Number),
        estimatedWaitTime: expect.any(Number),
      });
    });

    it('should create prompt without allowed tools', async () => {
      const promptData = {
        prompt: 'Explain TypeScript generics',
      };

      const response = await makeRequest(
        app,
        'POST',
        `/sessions/${testSession.id}/prompts`,
        promptData
      );

      assertSuccessResponse(response, 201);
      
      const result = parseResponse(response);
      expect(result.status).toBe('queued');
    });

    it('should return 404 for non-existent session', async () => {
      const nonExistentSessionId = generateTestId('session');
      
      const response = await makeRequest(
        app,
        'POST',
        `/sessions/${nonExistentSessionId}/prompts`,
        { prompt: 'Test prompt' }
      );

      assertErrorResponse(response, 404, 'Session not found');
    });

    it('should validate prompt data', async () => {
      const response = await makeRequest(
        app,
        'POST',
        `/sessions/${testSession.id}/prompts`,
        { /* missing prompt field */ }
      );

      expect(response.statusCode).toBe(400);
    });

    it('should respect rate limiting', async () => {
      // Make multiple requests rapidly to trigger rate limit
      const promises = Array.from({ length: 15 }, () =>
        makeRequest(
          app,
          'POST',
          `/sessions/${testSession.id}/prompts`,
          { prompt: 'Test prompt' }
        )
      );

      const responses = await Promise.all(promises);
      
      // Should have at least one rate-limited response
      const rateLimited = responses.some(r => r.statusCode === 429);
      expect(rateLimited).toBe(true);
    });

    it('should validate allowed tools', async () => {
      const promptData = {
        prompt: 'Test prompt',
        allowedTools: ['invalid-tool'],
      };

      const response = await makeRequest(
        app,
        'POST',
        `/sessions/${testSession.id}/prompts`,
        promptData
      );

      expect(response.statusCode).toBe(400);
    });

    it('should queue prompt with Claude directory service', async () => {
      const promptData = {
        prompt: 'Test prompt',
        allowedTools: ['read'],
      };

      const response = await makeRequest(
        app,
        'POST',
        `/sessions/${testSession.id}/prompts`,
        promptData
      );

      assertSuccessResponse(response, 201);
      
      const result = parseResponse(response);
      
      // Verify Claude directory service was called
      expect(mockClaudeService.writePromptRequest).toHaveBeenCalledWith(
        testSession.claudeDirectoryPath,
        result.id,
        promptData.prompt,
        promptData.allowedTools
      );
    });
  });

  describe('GET /sessions/:sessionId/prompts', () => {
    beforeEach(async () => {
      // Set up mock prompt history
      mockClaudeService._setMockFile(
        `${testSession.claudeDirectoryPath}/prompts/prompt-1/request.txt`,
        'First prompt'
      );
      mockClaudeService._setMockFile(
        `${testSession.claudeDirectoryPath}/prompts/prompt-1/response.json`,
        JSON.stringify({ content: 'First response' })
      );
      mockClaudeService._setMockFile(
        `${testSession.claudeDirectoryPath}/prompts/prompt-2/request.txt`,
        'Second prompt'
      );

      // Update mock data
      mockClaudeService._getMockData().promptHistory.push(
        {
          id: 'prompt-1',
          prompt: 'First prompt',
          timestamp: '2023-01-01T00:00:00Z',
          status: 'completed',
          result: { content: 'First response' },
        },
        {
          id: 'prompt-2',
          prompt: 'Second prompt',
          timestamp: '2023-01-01T01:00:00Z',
          status: 'pending',
        }
      );
    });

    it('should get prompt history', async () => {
      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/prompts`
      );

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      expect(result).toMatchObject({
        prompts: expect.arrayContaining([
          expect.objectContaining({
            id: 'prompt-1',
            prompt: 'First prompt',
            status: 'completed',
          }),
          expect.objectContaining({
            id: 'prompt-2',
            prompt: 'Second prompt',
            status: 'pending',
          }),
        ]),
        session: expect.objectContaining({
          id: testSession.id,
          isWorking: expect.any(Boolean),
        }),
        pagination: expect.objectContaining({
          page: 1,
          limit: 20,
          total: expect.any(Number),
        }),
      });
    });

    it('should support pagination', async () => {
      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/prompts?page=1&limit=1`
      );

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      expect(result.prompts).toHaveLength(1);
      expect(result.pagination).toMatchObject({
        page: 1,
        limit: 1,
      });
    });

    it('should filter by status', async () => {
      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/prompts?status=completed`
      );

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      expect(result.prompts.every((p: any) => p.status === 'completed')).toBe(true);
    });

    it('should return 404 for non-existent session', async () => {
      const nonExistentSessionId = generateTestId('session');
      
      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${nonExistentSessionId}/prompts`
      );

      assertErrorResponse(response, 404, 'Session not found');
    });

    it('should handle Claude directory errors gracefully', async () => {
      // Mock Claude directory service to throw error
      mockClaudeService.getPromptHistory = vi.fn(() => {
        throw new Error('Claude directory error');
      });

      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/prompts`
      );

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      expect(result.prompts).toEqual([]);
    });
  });

  describe('GET /sessions/:sessionId/prompts/:promptId', () => {
    const promptId = 'test-prompt-id';

    beforeEach(async () => {
      // Set up mock prompt data
      mockClaudeService._setMockFile(
        `${testSession.claudeDirectoryPath}/prompts/${promptId}/request.txt`,
        'Test prompt content'
      );
      mockClaudeService._setMockFile(
        `${testSession.claudeDirectoryPath}/prompts/${promptId}/response.json`,
        JSON.stringify({
          content: 'Test response',
          tools_used: ['read'],
          duration: 1500,
        })
      );

      mockClaudeService._getMockData().promptHistory.push({
        id: promptId,
        prompt: 'Test prompt content',
        timestamp: '2023-01-01T00:00:00Z',
        status: 'completed',
        result: {
          content: 'Test response',
          tools_used: ['read'],
          duration: 1500,
        },
      });
    });

    it('should get prompt details', async () => {
      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/prompts/${promptId}`
      );

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      expect(result).toMatchObject({
        id: promptId,
        prompt: 'Test prompt content',
        status: 'completed',
        response: expect.objectContaining({
          content: 'Test response',
          tools_used: ['read'],
          duration: 1500,
        }),
        createdAt: expect.any(String),
      });
    });

    it('should return 404 for non-existent prompt', async () => {
      const nonExistentPromptId = generateTestId('prompt');
      
      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/prompts/${nonExistentPromptId}`
      );

      assertErrorResponse(response, 404, 'Prompt not found');
    });

    it('should return 404 for non-existent session', async () => {
      const nonExistentSessionId = generateTestId('session');
      
      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${nonExistentSessionId}/prompts/${promptId}`
      );

      assertErrorResponse(response, 404, 'Session not found');
    });
  });

  describe('DELETE /sessions/:sessionId/prompts/:promptId', () => {
    const promptId = 'test-prompt-id';

    beforeEach(async () => {
      // Set up mock prompt data
      mockClaudeService._getMockData().promptHistory.push({
        id: promptId,
        prompt: 'Test prompt',
        timestamp: '2023-01-01T00:00:00Z',
        status: 'running',
      });
    });

    it('should cancel a running prompt', async () => {
      const response = await makeRequest(
        app,
        'DELETE',
        `/sessions/${testSession.id}/prompts/${promptId}`
      );

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      expect(result).toMatchObject({
        success: true,
        message: 'Prompt cancelled successfully',
      });

      // Verify Claude directory service was called
      expect(mockClaudeService.cancelPrompt).toHaveBeenCalledWith(
        testSession.claudeDirectoryPath,
        promptId
      );
    });

    it('should return 404 for non-existent prompt', async () => {
      const nonExistentPromptId = generateTestId('prompt');
      
      const response = await makeRequest(
        app,
        'DELETE',
        `/sessions/${testSession.id}/prompts/${nonExistentPromptId}`
      );

      assertErrorResponse(response, 404, 'Prompt not found');
    });

    it('should return 400 for already completed prompt', async () => {
      // Update prompt status to completed
      mockClaudeService._getMockData().promptHistory[0].status = 'completed';

      const response = await makeRequest(
        app,
        'DELETE',
        `/sessions/${testSession.id}/prompts/${promptId}`
      );

      assertErrorResponse(response, 400, 'Prompt cannot be cancelled');
    });
  });

  describe('GET /sessions/:sessionId/prompts/export', () => {
    beforeEach(async () => {
      // Set up mock export data
      mockClaudeService.exportSessionHistory = vi.fn(() => 
        Promise.resolve({
          content: 'Exported session history',
          format: 'markdown',
          generatedAt: new Date().toISOString(),
        })
      );
    });

    it('should export session history as markdown', async () => {
      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/prompts/export?format=markdown`
      );

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      expect(result).toMatchObject({
        content: 'Exported session history',
        format: 'markdown',
        generatedAt: expect.any(String),
      });
    });

    it('should export session history as JSON', async () => {
      mockClaudeService.exportSessionHistory = vi.fn(() => 
        Promise.resolve({
          content: '{"prompts": []}',
          format: 'json',
          generatedAt: new Date().toISOString(),
        })
      );

      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/prompts/export?format=json`
      );

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      expect(result.format).toBe('json');
    });

    it('should default to markdown format', async () => {
      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/prompts/export`
      );

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      expect(result.format).toBe('markdown');
    });

    it('should return 404 for non-existent session', async () => {
      const nonExistentSessionId = generateTestId('session');
      
      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${nonExistentSessionId}/prompts/export`
      );

      assertErrorResponse(response, 404, 'Session not found');
    });
  });

  describe('Schema validation', () => {
    it('should validate session ID format', async () => {
      const response = await makeRequest(
        app,
        'POST',
        '/sessions/invalid-uuid/prompts',
        { prompt: 'Test prompt' }
      );

      expect(response.statusCode).toBe(400);
    });

    it('should validate prompt ID format', async () => {
      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/prompts/invalid-uuid`
      );

      expect(response.statusCode).toBe(400);
    });

    it('should validate export format', async () => {
      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/prompts/export?format=invalid`
      );

      expect(response.statusCode).toBe(400);
    });

    it('should validate pagination parameters', async () => {
      const response = await makeRequest(
        app,
        'GET',
        `/sessions/${testSession.id}/prompts?page=0&limit=101`
      );

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Queue integration', () => {
    it('should integrate with queue service for job creation', async () => {
      const promptData = {
        prompt: 'Test prompt',
        allowedTools: ['read'],
      };

      const { queueService } = await import('@/services/queue.service');
      
      await makeRequest(
        app,
        'POST',
        `/sessions/${testSession.id}/prompts`,
        promptData
      );

      expect(queueService.addPromptJob).toHaveBeenCalledWith(
        testSession.id,
        expect.any(String), // prompt ID
        promptData.prompt,
        promptData.allowedTools
      );
    });

    it('should integrate with queue service for job cancellation', async () => {
      const promptId = 'test-prompt-id';
      
      // Set up mock prompt data
      mockClaudeService._getMockData().promptHistory.push({
        id: promptId,
        prompt: 'Test prompt',
        timestamp: '2023-01-01T00:00:00Z',
        status: 'running',
      });

      const { queueService } = await import('@/services/queue.service');
      
      await makeRequest(
        app,
        'DELETE',
        `/sessions/${testSession.id}/prompts/${promptId}`
      );

      expect(queueService.cancelJob).toHaveBeenCalledWith(
        expect.any(String), // job ID
        promptId
      );
    });
  });
});