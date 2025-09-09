import fs from 'node:fs';
import { createId } from '@paralleldrive/cuid2';
import type {
  CreateSessionRequest,
  ListSessionsQuery,
  UpdateSessionRequest,
} from '@pokecode/types';
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '../database';
import { sessions } from '../database/schema-sqlite';
import { NotFoundError, ValidationError } from '../types';
import {
  getBasename,
  getHomeDirectory,
  getParentPath,
  getRelativePath,
  joinPath,
} from '../utils/file';
import { logger } from '../utils/logger';

export class SessionService {
  async createSession(data: CreateSessionRequest) {
    // Generate session ID upfront to create session-specific Claude directory path
    const sessionId = createId();
    const projectKey = data.projectPath.replace(/\//g, '-').replace(/_/g, '-');
    const claudeDirectoryPath = joinPath(
      getHomeDirectory(),
      '.claude',
      'projects',
      projectKey,
      sessionId,
    );

    // Extract name from the project path (last path component)
    const name = this.extractNameFromPath(data.projectPath);

    // Create the session with all required data in a single operation
    const result = await db
      .insert(sessions)
      .values({
        id: sessionId,
        provider: data.provider,
        projectPath: data.projectPath,
        name,
        claudeDirectoryPath,
      })
      .returning();

    const session = result[0];
    if (!session) {
      throw new ValidationError('Failed to create session');
    }

    return this.formatSession(session);
  }

  async getSession(sessionId: string) {
    const session = await db.select().from(sessions).where(eq(sessions.id, sessionId)).get();

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Update last accessed timestamp
    await db.update(sessions).set({ lastAccessedAt: new Date() }).where(eq(sessions.id, sessionId));

    return this.formatSession(session);
  }

  async listSessions(options: ListSessionsQuery = {}) {
    logger.info({ options }, 'Listing sessions');

    const { limit = 20, offset = 0 } = options;
    // Always enforce a maximum limit of 20 sessions
    const effectiveLimit = Math.min(limit, 20);

    // Build where clause - only sessions with at least one message
    const whereClause = options.state
      ? and(isNotNull(sessions.lastMessageSentAt), eq(sessions.state, options.state))
      : and(isNotNull(sessions.lastMessageSentAt));

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(whereClause);
    const count = countResult[0]?.count ?? 0;

    // Get sessions ordered by last_message_sent_at (most recent message first)
    const results = await db
      .select()
      .from(sessions)
      .where(whereClause)
      .orderBy(desc(sessions.lastMessageSentAt))
      .limit(effectiveLimit)
      .offset(offset);

    logger.info({ results }, 'Sessions listed');

    // Format sessions (state is already filtered in SQL when provided)
    const formattedSessions = results.map((session) => this.formatSession(session));

    return {
      sessions: formattedSessions,
      total: Number(count),
      limit: effectiveLimit,
      offset,
    };
  }

  async updateSession(sessionId: string, data: UpdateSessionRequest) {
    // Verify session exists
    const session = await db.select().from(sessions).where(eq(sessions.id, sessionId)).get();

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Update session
    const updateData: Partial<typeof sessions.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.context !== undefined) {
      updateData.context = data.context;
    }
    if (data.metadata !== undefined) {
      updateData.metadata = { ...session.metadata, ...data.metadata };
    }

    const result = await db
      .update(sessions)
      .set(updateData)
      .where(eq(sessions.id, sessionId))
      .returning();

    const updated = result[0];
    if (!updated) {
      throw new NotFoundError('Session');
    }

    return this.formatSession(updated);
  }

  async deleteSession(sessionId: string) {
    // Verify session exists
    const session = await db.select().from(sessions).where(eq(sessions.id, sessionId)).get();

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Mark session as inactive instead of hard deletion
    await db
      .update(sessions)
      .set({ state: 'inactive', updatedAt: new Date() })
      .where(eq(sessions.id, sessionId));

    return { success: true };
  }

  async getActiveSessionCount(): Promise<number> {
    // Count sessions with state = 'active'
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(eq(sessions.state, 'active'));

    return result[0]?.count ?? 0;
  }

  private formatSession(session: typeof sessions.$inferSelect) {
    return {
      id: session.id,
      provider: session.provider,
      projectPath: session.projectPath,
      name: session.name,
      claudeDirectoryPath: session.claudeDirectoryPath,
      context: session.context,
      state: session.state,
      metadata: session.metadata,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      lastAccessedAt: session.lastAccessedAt.toISOString(),
      lastMessageSentAt: session.lastMessageSentAt ? session.lastMessageSentAt.toISOString() : null,
      // Working state fields
      isWorking: session.isWorking,
      currentJobId: session.currentJobId,
      lastJobStatus: session.lastJobStatus,
      // Token and message tracking
      messageCount: session.messageCount,
      tokenCount: session.tokenCount,
    };
  }

  private extractNameFromPath(projectPath: string): string {
    // Remove trailing slashes
    const cleaned = projectPath.replace(/\/+$/, '');

    // Try to find git repository root
    const gitRoot = this.findGitRoot(cleaned);

    if (gitRoot) {
      // Get the repository name from the git root directory
      const repoName = getBasename(gitRoot);

      // If the project path is the same as git root, just use repo name
      if (cleaned === gitRoot) {
        return repoName;
      }

      // Otherwise, create relative path from git root
      const relativePath = getRelativePath(gitRoot, cleaned);
      return `${repoName}/${relativePath}`;
    }

    // Fallback to just the directory name if no git root found
    const name = getBasename(cleaned);
    return name || 'root';
  }

  private findGitRoot(startPath: string): string | null {
    let currentPath = startPath;

    // Walk up the directory tree looking for .git directory
    while (currentPath !== getParentPath(currentPath)) {
      try {
        const gitPath = joinPath(currentPath, '.git');
        if (fs.existsSync(gitPath)) {
          return currentPath;
        }
      } catch (_error) {
        // Continue if we can't access the directory
      }
      currentPath = getParentPath(currentPath);
    }

    return null; // No git root found
  }
}

export const sessionService = new SessionService();
