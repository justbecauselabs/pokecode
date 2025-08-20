import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import { sql } from 'drizzle-orm';
import { db } from '../../src/db';
import { sessions } from '../../src/db/schema-sqlite';
import { sessionService } from '../../src/services/session.service';

describe('Session State Management', () => {
  let testSessionIds: string[] = [];

  beforeAll(async () => {
    // Clean up any existing test data
    await db.delete(sessions).where(sql`project_path LIKE '/test/%'`);
  });

  beforeEach(async () => {
    // Clean up previous test sessions
    if (testSessionIds.length > 0) {
      await db.delete(sessions).where(sql`id IN (${testSessionIds.map(() => '?').join(', ')})`);
      testSessionIds = [];
    }
  });

  describe('Database Schema', () => {
    test('should allow creating sessions with active state', async () => {
      const sessionId = createId();
      testSessionIds.push(sessionId);

      const result = await db
        .insert(sessions)
        .values({
          id: sessionId,
          projectPath: '/test/active-session',
          name: 'Active Session',
          state: 'active',
        })
        .returning();

      expect(result).toHaveLength(1);
      expect(result[0].state).toBe('active');
    });

    test('should allow creating sessions with inactive state', async () => {
      const sessionId = createId();
      testSessionIds.push(sessionId);

      const result = await db
        .insert(sessions)
        .values({
          id: sessionId,
          projectPath: '/test/inactive-session',
          name: 'Inactive Session',
          state: 'inactive',
        })
        .returning();

      expect(result).toHaveLength(1);
      expect(result[0].state).toBe('inactive');
    });

    test('should default to active state when not specified', async () => {
      const sessionId = createId();
      testSessionIds.push(sessionId);

      const result = await db
        .insert(sessions)
        .values({
          id: sessionId,
          projectPath: '/test/default-session',
          name: 'Default Session',
        })
        .returning();

      expect(result).toHaveLength(1);
      expect(result[0].state).toBe('active');
    });
  });

  describe('SessionService', () => {
    test('should create sessions with active state by default', async () => {
      const session = await sessionService.createSession({
        projectPath: '/test/new-session',
      });

      testSessionIds.push(session.id);

      expect(session.state).toBe('active');
    });

    test('should return state field in session format', async () => {
      const sessionId = createId();
      testSessionIds.push(sessionId);

      await db.insert(sessions).values({
        id: sessionId,
        projectPath: '/test/format-session',
        name: 'Format Session',
        state: 'inactive',
      });

      const session = await sessionService.getSession(sessionId);

      expect(session).toHaveProperty('state');
      expect(session.state).toBe('inactive');
      expect(session).not.toHaveProperty('status');
    });

    test('should filter sessions by state in listSessions', async () => {
      // Create active and inactive sessions
      const activeSessionId = createId();
      const inactiveSessionId = createId();
      testSessionIds.push(activeSessionId, inactiveSessionId);

      await db.insert(sessions).values([
        {
          id: activeSessionId,
          projectPath: '/test/active-list',
          name: 'Active List Session',
          state: 'active',
        },
        {
          id: inactiveSessionId,
          projectPath: '/test/inactive-list',
          name: 'Inactive List Session',
          state: 'inactive',
        },
      ]);

      // Filter for active sessions
      const activeSessions = await sessionService.listSessions({ state: 'active' });
      const activeSessionsData = activeSessions.sessions.filter(
        (s) => s.id === activeSessionId || s.id === inactiveSessionId,
      );

      expect(activeSessionsData).toHaveLength(1);
      expect(activeSessionsData[0].state).toBe('active');

      // Filter for inactive sessions
      const inactiveSessions = await sessionService.listSessions({ state: 'inactive' });
      const inactiveSessionsData = inactiveSessions.sessions.filter(
        (s) => s.id === activeSessionId || s.id === inactiveSessionId,
      );

      expect(inactiveSessionsData).toHaveLength(1);
      expect(inactiveSessionsData[0].state).toBe('inactive');
    });

    test('should implement soft delete by setting state to inactive', async () => {
      const sessionId = createId();
      testSessionIds.push(sessionId);

      // Create active session
      await db.insert(sessions).values({
        id: sessionId,
        projectPath: '/test/soft-delete',
        name: 'Soft Delete Session',
        state: 'active',
      });

      // Verify session exists and is active
      const beforeDelete = await sessionService.getSession(sessionId);
      expect(beforeDelete.state).toBe('active');

      // Delete session (should soft delete)
      const result = await sessionService.deleteSession(sessionId);
      expect(result.success).toBe(true);

      // Verify session still exists but is inactive
      const afterDelete = await sessionService.getSession(sessionId);
      expect(afterDelete.state).toBe('inactive');
    });

    test('should count only active sessions in getActiveSessionCount', async () => {
      // Create multiple sessions with different states
      const activeSession1Id = createId();
      const activeSession2Id = createId();
      const inactiveSessionId = createId();
      testSessionIds.push(activeSession1Id, activeSession2Id, inactiveSessionId);

      await db.insert(sessions).values([
        {
          id: activeSession1Id,
          projectPath: '/test/count-active-1',
          name: 'Count Active 1',
          state: 'active',
        },
        {
          id: activeSession2Id,
          projectPath: '/test/count-active-2',
          name: 'Count Active 2',
          state: 'active',
        },
        {
          id: inactiveSessionId,
          projectPath: '/test/count-inactive',
          name: 'Count Inactive',
          state: 'inactive',
        },
      ]);

      const activeCount = await sessionService.getActiveSessionCount();

      // Should count at least our 2 active test sessions (might be more from other tests)
      expect(activeCount).toBeGreaterThanOrEqual(2);

      // Verify by checking actual sessions
      const allSessions = await sessionService.listSessions({});
      const testActiveSessions = allSessions.sessions.filter(
        (s) => [activeSession1Id, activeSession2Id].includes(s.id) && s.state === 'active',
      );
      const testInactiveSessions = allSessions.sessions.filter(
        (s) => s.id === inactiveSessionId && s.state === 'inactive',
      );

      expect(testActiveSessions).toHaveLength(2);
      expect(testInactiveSessions).toHaveLength(1);
    });

    test('should update session and maintain state', async () => {
      const sessionId = createId();
      testSessionIds.push(sessionId);

      await db.insert(sessions).values({
        id: sessionId,
        projectPath: '/test/update-session',
        name: 'Update Session',
        state: 'active',
      });

      // Update session context
      const updated = await sessionService.updateSession(sessionId, {
        context: 'Updated context',
      });

      expect(updated.state).toBe('active');
      expect(updated.context).toBe('Updated context');
    });
  });

  describe('Migration Behavior', () => {
    test('should handle legacy sessions without state field gracefully', async () => {
      // This test simulates what happens when the migration runs
      const sessionId = createId();
      testSessionIds.push(sessionId);

      // Insert session using regular insert (simulating pre-migration data with default state)
      await db.insert(sessions).values({
        id: sessionId,
        projectPath: '/test/legacy-session',
        name: 'Legacy Session',
      });

      // The session should have the default 'active' state
      const session = await sessionService.getSession(sessionId);
      expect(session.state).toBe('active');
    });

    test('should demonstrate migration concept with manual state updates', async () => {
      const sessionId = createId();
      testSessionIds.push(sessionId);

      // Create session as active
      await db.insert(sessions).values({
        id: sessionId,
        projectPath: '/test/migration-demo',
        name: 'Migration Demo Session',
        state: 'active',
      });

      // Verify it starts active
      const beforeMigration = await sessionService.getSession(sessionId);
      expect(beforeMigration.state).toBe('active');

      // Simulate manual migration (setting old sessions to inactive)
      await db
        .update(sessions)
        .set({ state: 'inactive' })
        .where(sql`project_path = '/test/migration-demo'`);

      // Verify migration worked
      const afterMigration = await sessionService.getSession(sessionId);
      expect(afterMigration.state).toBe('inactive');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty session list gracefully', async () => {
      const result = await sessionService.listSessions({ state: 'active' });
      expect(result).toHaveProperty('sessions');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('offset');
      expect(Array.isArray(result.sessions)).toBe(true);
    });

    test('should throw error when deleting non-existent session', async () => {
      const nonExistentId = createId();

      await expect(sessionService.deleteSession(nonExistentId)).rejects.toThrow(
        'Session not found',
      );
    });

    test('should throw error when getting non-existent session', async () => {
      const nonExistentId = createId();

      await expect(sessionService.getSession(nonExistentId)).rejects.toThrow('Session not found');
    });

    test('should handle multiple consecutive soft deletes', async () => {
      const sessionId = createId();
      testSessionIds.push(sessionId);

      await db.insert(sessions).values({
        id: sessionId,
        projectPath: '/test/multiple-delete',
        name: 'Multiple Delete Session',
        state: 'active',
      });

      // First delete
      await sessionService.deleteSession(sessionId);
      const afterFirst = await sessionService.getSession(sessionId);
      expect(afterFirst.state).toBe('inactive');

      // Second delete (should still work)
      const result = await sessionService.deleteSession(sessionId);
      expect(result.success).toBe(true);

      const afterSecond = await sessionService.getSession(sessionId);
      expect(afterSecond.state).toBe('inactive');
    });
  });
});
