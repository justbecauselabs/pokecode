import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createTestApp, cleanupTestApp, makeRequest, parseResponse, assertSuccessResponse, assertErrorResponse, generateTestId } from '../helpers/fastify.helpers';
import { createTestSession, getTestDatabase } from '../helpers/database.helpers';
import { createMockClaudeDirectoryService, mockClaudeDirectoryModule } from '../helpers/claude-directory.mock';
import * as schema from '@/db/schema';

describe('Session Routes', () => {
  let app: FastifyInstance;
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

    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestApp(app);
  });

  beforeEach(() => {
    mockClaudeService._clearMockData();
  });

  describe('POST /sessions', () => {
    it('should create session with projectPath', async () => {
      const projectPath = '/test/project';
      
      const response = await makeRequest(app, 'POST', '/sessions', {
        projectPath,
      });

      assertSuccessResponse(response, 201);
      
      const session = parseResponse(response);
      expect(session).toMatchObject({
        id: expect.any(String),
        projectPath,
        claudeDirectoryPath: expect.any(String),
        status: 'active',
        context: null,
        metadata: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        lastAccessedAt: expect.any(String),
      });
    });

    it('should create session with folderName', async () => {
      const folderName = 'test-repo';
      
      const response = await makeRequest(app, 'POST', '/sessions', {
        folderName,
      });

      assertSuccessResponse(response, 201);
      
      const session = parseResponse(response);
      expect(session).toMatchObject({
        id: expect.any(String),
        projectPath: `/test/repos/${folderName}`,
        claudeDirectoryPath: expect.any(String),
        status: 'active',
      });
    });

    it('should create session with context and metadata', async () => {
      const requestData = {
        projectPath: '/test/project',
        context: 'Test context',
        metadata: { branch: 'main', version: '1.0.0' },
      };

      const response = await makeRequest(app, 'POST', '/sessions', requestData);

      assertSuccessResponse(response, 201);
      
      const session = parseResponse(response);
      expect(session).toMatchObject({
        projectPath: requestData.projectPath,
        context: requestData.context,
        metadata: requestData.metadata,
      });
    });

    it('should return 400 when neither projectPath nor folderName provided', async () => {
      const response = await makeRequest(app, 'POST', '/sessions', {});

      assertErrorResponse(response, 400, 'Either projectPath or folderName must be provided');
    });

    it('should return 400 when both projectPath and folderName provided', async () => {
      const response = await makeRequest(app, 'POST', '/sessions', {
        projectPath: '/test/project',
        folderName: 'test-repo',
      });

      assertErrorResponse(response, 400, 'Cannot provide both projectPath and folderName');
    });

    it('should return 400 for invalid projectPath', async () => {
      const response = await makeRequest(app, 'POST', '/sessions', {
        projectPath: '../relative/path',
      });

      assertErrorResponse(response, 400);
    });

    it('should validate Claude directory initialization', async () => {
      const response = await makeRequest(app, 'POST', '/sessions', {
        projectPath: '/test/project',
      });

      assertSuccessResponse(response, 201);
      
      // Verify Claude directory service was called
      expect(mockClaudeService.initializeClaudeDirectory).toHaveBeenCalledWith('/test/project');
    });
  });

  describe('GET /sessions', () => {
    let testSessions: Array<typeof schema.sessions.$inferSelect>;

    beforeEach(async () => {
      // Create test sessions
      testSessions = [
        await createTestSession({
          projectPath: '/test/project1',
          context: 'First project',
          status: 'active',
        }),
        await createTestSession({
          projectPath: '/test/project2',
          context: 'Second project',
          status: 'inactive',
        }),
        await createTestSession({
          projectPath: '/test/project3',
          context: 'Third project',
          status: 'active',
        }),
      ];
    });

    it('should list all sessions', async () => {
      const response = await makeRequest(app, 'GET', '/sessions');

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      expect(result).toMatchObject({
        sessions: expect.arrayContaining([
          expect.objectContaining({
            id: testSessions[0].id,
            projectPath: '/test/project1',
          }),
          expect.objectContaining({
            id: testSessions[1].id,
            projectPath: '/test/project2',
          }),
          expect.objectContaining({
            id: testSessions[2].id,
            projectPath: '/test/project3',
          }),
        ]),
        pagination: expect.objectContaining({
          page: 1,
          limit: 20,
          total: expect.any(Number),
        }),
      });
    });

    it('should filter sessions by status', async () => {
      const response = await makeRequest(app, 'GET', '/sessions?status=active');

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions.every((s: any) => s.status === 'active')).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await makeRequest(app, 'GET', '/sessions?page=1&limit=2');

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      expect(result.sessions).toHaveLength(2);
      expect(result.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: expect.any(Number),
      });
    });

    it('should search sessions by projectPath', async () => {
      const response = await makeRequest(app, 'GET', '/sessions?search=project1');

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].projectPath).toContain('project1');
    });
  });

  describe('GET /sessions/:sessionId', () => {
    let testSession: typeof schema.sessions.$inferSelect;

    beforeEach(async () => {
      testSession = await createTestSession({
        projectPath: '/test/project',
        context: 'Test session',
        metadata: { version: '1.0.0' },
      });
    });

    it('should get session by ID', async () => {
      const response = await makeRequest(app, 'GET', `/sessions/${testSession.id}`);

      assertSuccessResponse(response, 200);
      
      const session = parseResponse(response);
      expect(session).toMatchObject({
        id: testSession.id,
        projectPath: testSession.projectPath,
        context: testSession.context,
        metadata: testSession.metadata,
        status: testSession.status,
      });
    });

    it('should return 404 for non-existent session', async () => {
      const nonExistentId = generateTestId('session');
      const response = await makeRequest(app, 'GET', `/sessions/${nonExistentId}`);

      assertErrorResponse(response, 404, 'Session not found');
    });

    it('should validate session ID format', async () => {
      const response = await makeRequest(app, 'GET', '/sessions/invalid-id');

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PATCH /sessions/:sessionId', () => {
    let testSession: typeof schema.sessions.$inferSelect;

    beforeEach(async () => {
      testSession = await createTestSession({
        projectPath: '/test/project',
        context: 'Original context',
        metadata: { version: '1.0.0' },
      });
    });

    it('should update session context', async () => {
      const updateData = {
        context: 'Updated context',
      };

      const response = await makeRequest(app, 'PATCH', `/sessions/${testSession.id}`, updateData);

      assertSuccessResponse(response, 200);
      
      const updatedSession = parseResponse(response);
      expect(updatedSession.context).toBe(updateData.context);
      expect(updatedSession.id).toBe(testSession.id);
    });

    it('should update session metadata', async () => {
      const updateData = {
        metadata: { version: '2.0.0', feature: 'new' },
      };

      const response = await makeRequest(app, 'PATCH', `/sessions/${testSession.id}`, updateData);

      assertSuccessResponse(response, 200);
      
      const updatedSession = parseResponse(response);
      expect(updatedSession.metadata).toEqual(updateData.metadata);
    });

    it('should update session status', async () => {
      const updateData = {
        status: 'inactive' as const,
      };

      const response = await makeRequest(app, 'PATCH', `/sessions/${testSession.id}`, updateData);

      assertSuccessResponse(response, 200);
      
      const updatedSession = parseResponse(response);
      expect(updatedSession.status).toBe('inactive');
    });

    it('should return 404 for non-existent session', async () => {
      const nonExistentId = generateTestId('session');
      const response = await makeRequest(app, 'PATCH', `/sessions/${nonExistentId}`, {
        context: 'New context',
      });

      assertErrorResponse(response, 404, 'Session not found');
    });

    it('should validate update data', async () => {
      const response = await makeRequest(app, 'PATCH', `/sessions/${testSession.id}`, {
        status: 'invalid-status',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /sessions/:sessionId', () => {
    let testSession: typeof schema.sessions.$inferSelect;

    beforeEach(async () => {
      testSession = await createTestSession({
        projectPath: '/test/project',
      });
    });

    it('should delete session', async () => {
      const response = await makeRequest(app, 'DELETE', `/sessions/${testSession.id}`);

      assertSuccessResponse(response, 200);
      
      const result = parseResponse(response);
      expect(result).toMatchObject({
        success: true,
      });

      // Verify session is deleted
      const getResponse = await makeRequest(app, 'GET', `/sessions/${testSession.id}`);
      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent session', async () => {
      const nonExistentId = generateTestId('session');
      const response = await makeRequest(app, 'DELETE', `/sessions/${nonExistentId}`);

      assertErrorResponse(response, 404, 'Session not found');
    });

    it('should cleanup Claude directory on deletion', async () => {
      const response = await makeRequest(app, 'DELETE', `/sessions/${testSession.id}`);

      assertSuccessResponse(response, 200);
      
      // Verify Claude directory cleanup was called
      expect(mockClaudeService.cleanupClaudeDirectory).toHaveBeenCalledWith(
        testSession.claudeDirectoryPath
      );
    });
  });

  describe('Schema validation', () => {
    it('should validate create session request schema', async () => {
      const response = await makeRequest(app, 'POST', '/sessions', {
        projectPath: '/test/project',
        invalidField: 'should be ignored',
      });

      assertSuccessResponse(response, 201);
      
      const session = parseResponse(response);
      expect(session).not.toHaveProperty('invalidField');
    });

    it('should reject invalid session status in update', async () => {
      const testSession = await createTestSession({
        projectPath: '/test/project',
      });

      const response = await makeRequest(app, 'PATCH', `/sessions/${testSession.id}`, {
        status: 'invalid',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate session ID parameter format', async () => {
      const response = await makeRequest(app, 'GET', '/sessions/123');

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Database integration', () => {
    it('should persist session data correctly', async () => {
      const sessionData = {
        projectPath: '/test/project',
        context: 'Test context',
        metadata: { version: '1.0.0' },
      };

      const response = await makeRequest(app, 'POST', '/sessions', sessionData);
      assertSuccessResponse(response, 201);
      
      const session = parseResponse(response);

      // Verify in database
      const db = getTestDatabase();
      const dbSession = await db.query.sessions.findFirst({
        where: (sessions, { eq }) => eq(sessions.id, session.id),
      });

      expect(dbSession).toMatchObject({
        id: session.id,
        projectPath: sessionData.projectPath,
        context: sessionData.context,
        metadata: sessionData.metadata,
      });
    });

    it('should handle database constraints', async () => {
      // This test would depend on specific database constraints
      // For now, just ensure it doesn't crash
      const response = await makeRequest(app, 'POST', '/sessions', {
        projectPath: '/test/project',
      });

      expect(response.statusCode).toBeOneOf([201, 400, 409]);
    });
  });
});