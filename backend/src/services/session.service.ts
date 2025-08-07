import path from 'node:path';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { sessions } from '@/db/schema';
import { NotFoundError, ValidationError } from '@/types';

export class SessionService {
  async createSession(
    userId: string,
    data: {
      projectPath: string;
      context?: string;
      metadata?: any;
    },
  ) {
    // Validate project path
    if (!this.isValidProjectPath(data.projectPath)) {
      throw new ValidationError('Invalid project path');
    }

    const [session] = await db
      .insert(sessions)
      .values({
        userId,
        projectPath: data.projectPath,
        context: data.context,
        metadata: data.metadata,
        status: 'active',
      })
      .returning();

    return this.formatSession(session);
  }

  async getSession(sessionId: string, userId: string) {
    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, sessionId), eq(sessions.userId, userId)),
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Update last accessed timestamp
    await db.update(sessions).set({ lastAccessedAt: sql`CURRENT_TIMESTAMP` }).where(eq(sessions.id, sessionId));

    return this.formatSession(session);
  }

  async listSessions(
    userId: string,
    options: {
      status?: 'active' | 'inactive' | 'archived';
      limit?: number;
      offset?: number;
    },
  ) {
    const { status, limit = 20, offset = 0 } = options;

    // Build where clause
    const whereConditions = [eq(sessions.userId, userId)];
    if (status) {
      whereConditions.push(eq(sessions.status, status));
    }

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(and(...whereConditions));

    // Get sessions
    const results = await db.query.sessions.findMany({
      where: and(...whereConditions),
      orderBy: [desc(sessions.lastAccessedAt)],
      limit,
      offset,
    });

    return {
      sessions: results.map(this.formatSession),
      total: Number(count),
      limit,
      offset,
    };
  }

  async updateSession(
    sessionId: string,
    userId: string,
    data: {
      context?: string;
      status?: 'active' | 'inactive' | 'archived';
      metadata?: any;
    },
  ) {
    // Verify ownership
    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, sessionId), eq(sessions.userId, userId)),
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Update session
    const updateData: any = {
      updatedAt: sql`CURRENT_TIMESTAMP`,
    };

    if (data.context !== undefined) {
      updateData.context = data.context;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.metadata !== undefined) {
      updateData.metadata = { ...session.metadata, ...data.metadata };
    }

    const [updated] = await db
      .update(sessions)
      .set(updateData)
      .where(eq(sessions.id, sessionId))
      .returning();

    return this.formatSession(updated);
  }

  async deleteSession(sessionId: string, userId: string) {
    // Verify ownership
    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, sessionId), eq(sessions.userId, userId)),
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Delete session (cascades to prompts and file access)
    await db.delete(sessions).where(eq(sessions.id, sessionId));

    return { success: true };
  }

  async getActiveSessionCount(userId: string): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.status, 'active')));

    return Number(count);
  }

  private formatSession(session: any) {
    return {
      id: session.id,
      userId: session.userId,
      projectPath: session.projectPath,
      context: session.context,
      status: session.status,
      metadata: session.metadata,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      lastAccessedAt: session.lastAccessedAt.toISOString(),
    };
  }

  private isValidProjectPath(projectPath: string): boolean {
    // Prevent path traversal
    if (projectPath.includes('..')) {
      return false;
    }

    // Must start with / or be relative
    if (!projectPath.startsWith('/') && !projectPath.match(/^[a-zA-Z0-9]/)) {
      return false;
    }

    // Normalize and check
    const normalized = path.normalize(projectPath);
    return normalized === projectPath;
  }
}

export const sessionService = new SessionService();
