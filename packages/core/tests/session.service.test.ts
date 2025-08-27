import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { sessionService } from '../src/services/session.service';
import { NotFoundError } from '../src/types';
import { 
  testEnvironment,
  testData,
  createTestSession,
  createTestSessions,
} from './test-setup';
import path from 'node:path';

describe('SessionService Integration Tests', () => {
  beforeEach(async () => {
    await testEnvironment.setup();
  });

  afterEach(async () => {
    await testEnvironment.teardown();
  });

  describe('createSession', () => {
    it('should create a new session with generated ID', async () => {
      const projectPath = testData.projectPaths.simple;
      
      const session = await sessionService.createSession({ projectPath });

      expect(session).toMatchObject({
        projectPath,
        name: 'myapp',
        state: 'active',
        isWorking: false,
        messageCount: 0,
        tokenCount: 0,
      });
      expect(session.id).toBeString();
      expect(session.claudeDirectoryPath).toContain('.claude');
      expect(session.claudeDirectoryPath).toContain(session.id);
    });

    it('should extract name from project path correctly', async () => {
      const testCases = [
        { path: '/Users/test/projects/myapp', expectedName: 'myapp' },
        { path: '/Users/test/projects/my-app/', expectedName: 'my-app' },
        { path: '/Users/test/projects/my_app', expectedName: 'my_app' },
        { path: '/', expectedName: 'root' },
      ];

      for (const { path: projectPath, expectedName } of testCases) {
        const session = await sessionService.createSession({ projectPath });
        expect(session.name).toBe(expectedName);
      }
    });

    it('should handle git repository paths', async () => {
      // Create a temporary directory structure with .git
      const tempDir = `/tmp/test-git-${Date.now()}`;
      const gitPath = path.join(tempDir, '.git');
      const nestedPath = path.join(tempDir, 'src', 'components');
      
      // Use Bun's file system API instead of Node.js fs
      const tempDirFile = Bun.file(tempDir);
      await Bun.write(path.join(gitPath, '.gitkeep'), '');
      await Bun.write(path.join(nestedPath, '.gitkeep'), '');

      try {
        // Test git root
        const rootSession = await sessionService.createSession({ projectPath: tempDir });
        expect(rootSession.name).toBe(path.basename(tempDir));

        // Test nested path within git repo
        const nestedSession = await sessionService.createSession({ projectPath: nestedPath });
        expect(nestedSession.name).toBe(`${path.basename(tempDir)}/src/components`);
      } finally {
        // Cleanup using async operation
        await Bun.$`rm -rf ${tempDir}`;
      }
    });

    it('should generate unique session IDs', async () => {
      const projectPath = testData.projectPaths.simple;
      
      const session1 = await sessionService.createSession({ projectPath });
      const session2 = await sessionService.createSession({ projectPath });
      
      expect(session1.id).not.toBe(session2.id);
      expect(session1.claudeDirectoryPath).not.toBe(session2.claudeDirectoryPath);
    });

    it('should create proper Claude directory path', async () => {
      const projectPath = '/Users/test/my-project/src';
      
      const session = await sessionService.createSession({ projectPath });
      
      expect(session.claudeDirectoryPath).toMatch(/\.claude\/projects\/-Users-test-my-project-src\/[a-z0-9]+$/);
    });
  });

  describe('getSession', () => {
    it('should retrieve an existing session', async () => {
      const projectPath = testData.projectPaths.simple;
      const created = await sessionService.createSession({ projectPath });
      
      const retrieved = await sessionService.getSession(created.id);
      
      expect(retrieved).toMatchObject({
        id: created.id,
        projectPath,
        name: 'myapp',
      });
    });

    it('should throw NotFoundError for non-existent session', async () => {
      expect(async () => {
        await sessionService.getSession('non-existent-id');
      }).toThrow(NotFoundError);
    });
  });

  describe('listSessions', () => {
    let sessionIds: string[];
    
    beforeEach(async () => {
      // Create multiple sessions for testing using helper
      sessionIds = await createTestSessions(3);
    });

    it('should list all sessions with default pagination', async () => {
      const result = await sessionService.listSessions();
      
      expect(result.sessions).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('should respect limit parameter', async () => {
      const result = await sessionService.listSessions({ limit: 2 });
      
      expect(result.sessions).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.limit).toBe(2);
    });

    it('should enforce maximum limit of 20', async () => {
      const result = await sessionService.listSessions({ limit: 50 });
      
      expect(result.limit).toBe(20);
    });

    it('should handle offset pagination', async () => {
      const page1 = await sessionService.listSessions({ limit: 2, offset: 0 });
      const page2 = await sessionService.listSessions({ limit: 2, offset: 2 });
      
      expect(page1.sessions).toHaveLength(2);
      expect(page2.sessions).toHaveLength(1);
      expect(page1.sessions[0].id).not.toBe(page2.sessions[0]?.id);
    });

    it('should return all sessions', async () => {
      const list = await sessionService.listSessions();
      expect(list.sessions).toHaveLength(3);
      
      // Verify all three projects are present
      const paths = list.sessions.map(s => s.projectPath).sort();
      expect(paths).toEqual(['/project1', '/project2', '/project3']);
    });

    it('should filter sessions by state', async () => {
      // Mark one session as inactive
      const allSessions = (await sessionService.listSessions()).sessions;
      if (allSessions[0]) {
        await sessionService.deleteSession(allSessions[0].id);
      }
      
      const activeSessions = await sessionService.listSessions({ state: 'active' });
      const inactiveSessions = await sessionService.listSessions({ state: 'inactive' });
      
      expect(activeSessions.sessions).toHaveLength(2);
      expect(inactiveSessions.sessions).toHaveLength(1);
    });
  });

  describe('updateSession', () => {
    let sessionId: string;

    beforeEach(async () => {
      const session = await sessionService.createSession({ projectPath: testData.projectPaths.simple });
      sessionId = session.id;
    });

    it('should update session context', async () => {
      const context = testData.contexts.simple;
      
      const updated = await sessionService.updateSession(sessionId, { context });
      
      expect(updated.context).toBe(context);
      expect(updated.id).toBe(sessionId);
    });

    it('should update session metadata', async () => {
      const metadata = testData.metadata.basic;
      
      const updated = await sessionService.updateSession(sessionId, { metadata });
      
      expect(updated.metadata).toEqual(metadata);
    });

    it('should merge metadata updates', async () => {
      await sessionService.updateSession(sessionId, { 
        metadata: { repository: 'https://github.com/test/repo' } 
      });
      
      const updated = await sessionService.updateSession(sessionId, {
        metadata: { branch: 'main' }
      });
      
      expect(updated.metadata).toEqual({
        repository: 'https://github.com/test/repo',
        branch: 'main',
      });
    });

    it('should throw NotFoundError for non-existent session', async () => {
      expect(async () => {
        await sessionService.updateSession('non-existent', { context: 'Test' });
      }).toThrow(NotFoundError);
    });
  });

  describe('deleteSession', () => {
    let sessionId: string;

    beforeEach(async () => {
      const session = await sessionService.createSession({ projectPath: testData.projectPaths.simple });
      sessionId = session.id;
    });

    it('should mark session as inactive instead of deleting', async () => {
      const result = await sessionService.deleteSession(sessionId);
      
      expect(result.success).toBe(true);
      
      // Verify session still exists but is inactive
      const session = await sessionService.getSession(sessionId);
      expect(session.state).toBe('inactive');
    });

    it('should throw NotFoundError for non-existent session', async () => {
      expect(async () => {
        await sessionService.deleteSession('non-existent');
      }).toThrow(NotFoundError);
    });
  });

  describe('getActiveSessionCount', () => {
    it('should count only active sessions', async () => {
      // Create sessions using helper
      const sessionIds = await createTestSessions(3);
      
      // Initially all should be active
      expect(await sessionService.getActiveSessionCount()).toBe(3);
      
      // Delete one session
      await sessionService.deleteSession(sessionIds[0]);
      expect(await sessionService.getActiveSessionCount()).toBe(2);
      
      // Delete another
      await sessionService.deleteSession(sessionIds[1]);
      expect(await sessionService.getActiveSessionCount()).toBe(1);
    });

    it('should return 0 when no active sessions', async () => {
      expect(await sessionService.getActiveSessionCount()).toBe(0);
    });
  });
});