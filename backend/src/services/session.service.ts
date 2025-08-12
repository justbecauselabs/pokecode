import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { sessions } from '@/db/schema';
import ClaudeDirectoryService from '@/services/claude-directory.service';
import { repositoryService } from '@/services/repository.service';
import { NotFoundError, ValidationError } from '@/types';

export class SessionService {
  async createSession(data: {
    projectPath?: string;
    folderName?: string;
    context?: string;
    metadata?: any;
  }) {
    // Validate that either projectPath or folderName is provided
    if (!data.projectPath && !data.folderName) {
      throw new ValidationError('Either projectPath or folderName must be provided');
    }

    // Validate that both are not provided
    if (data.projectPath && data.folderName) {
      throw new ValidationError('Cannot provide both projectPath and folderName');
    }

    let projectPath: string;

    if (data.folderName) {
      // Use repository service to resolve folder name to absolute path
      try {
        projectPath = repositoryService.resolveFolderPath(data.folderName);

        // Validate that the repository exists
        const validation = await repositoryService.validateRepository(data.folderName);
        if (!validation.exists) {
          throw new ValidationError(`Repository folder '${data.folderName}' does not exist`);
        }
      } catch (error: any) {
        throw new ValidationError(`Invalid repository folder: ${error.message}`);
      }
    } else if (data.projectPath) {
      // Use existing projectPath validation
      projectPath = this.normalizeProjectPath(data.projectPath);
    } else {
      // This should never happen due to validation above, but TypeScript doesn't know that
      throw new ValidationError('Either projectPath or folderName must be provided');
    }

    // Generate session ID upfront to create session-specific Claude directory path
    const sessionId = randomUUID();
    const claudeDirectoryPath = ClaudeDirectoryService.getClaudeDirectoryPath(
      projectPath,
      sessionId,
    );

    // Create the session with all required data in a single operation
    const [session] = await db
      .insert(sessions)
      .values({
        id: sessionId,
        projectPath,
        claudeDirectoryPath,
        status: 'active',
        ...(data.context !== undefined && { context: data.context }),
        ...(data.metadata !== undefined && { metadata: data.metadata }),
      })
      .returning();

    return this.formatSession(session);
  }

  async getSession(sessionId: string) {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Update last accessed timestamp
    await db.update(sessions).set({ lastAccessedAt: new Date() }).where(eq(sessions.id, sessionId));

    return this.formatSession(session);
  }

  async listSessions(
    options: { status?: 'active' | 'inactive' | 'archived'; limit?: number; offset?: number } = {},
  ) {
    const { status, limit = 20, offset = 0 } = options;

    // Build where clause - only show sessions that have Claude Code session IDs
    let whereClause = sql`${sessions.claudeCodeSessionId} IS NOT NULL`;

    if (status) {
      whereClause = sql`${whereClause} AND ${eq(sessions.status, status)}`;
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(whereClause);
    const count = countResult[0]?.count ?? 0;

    // Get sessions
    const results = await db.query.sessions.findMany({
      where: whereClause,
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
    data: {
      context?: string;
      status?: 'active' | 'inactive' | 'archived';
      metadata?: any;
    },
  ) {
    // Verify session exists
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Update session
    const updateData: any = {
      updatedAt: new Date(),
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

  async deleteSession(sessionId: string) {
    // Verify session exists
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Delete session (cascades to prompts and file access)
    await db.delete(sessions).where(eq(sessions.id, sessionId));

    return { success: true };
  }

  async getActiveSessionCount(): Promise<number> {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(eq(sessions.status, 'active'));

    return Number(countResult[0]?.count ?? 0);
  }

  /**
   * Get conversation history from Claude directory for a session
   */
  async getSessionConversations(sessionId: string) {
    const session = await this.getSession(sessionId);

    if (!session.claudeDirectoryPath) {
      throw new ValidationError('Session does not have Claude directory path configured');
    }

    const claudeService = ClaudeDirectoryService.forSessionDirectory(session.claudeDirectoryPath);
    return claudeService.getProjectConversations(session.projectPath);
  }

  /**
   * Get the most recent conversation for a session
   */
  async getMostRecentConversation(sessionId: string) {
    const session = await this.getSession(sessionId);

    const claudeService = ClaudeDirectoryService.forSessionDirectory(session.claudeDirectoryPath);
    return claudeService.getMostRecentConversation(session.projectPath);
  }

  /**
   * Check if Claude directory is available for a session
   */
  async isClaudeDirectoryAvailable(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);

    if (!session.claudeDirectoryPath) {
      return false;
    }

    const claudeService = ClaudeDirectoryService.forSessionDirectory(session.claudeDirectoryPath);
    return claudeService.isInitialized();
  }

  private formatSession(session: any) {
    return {
      id: session.id,
      projectPath: session.projectPath,
      claudeDirectoryPath: session.claudeDirectoryPath,
      claudeCodeSessionId: session.claudeCodeSessionId,
      context: session.context,
      status: session.status,
      metadata: session.metadata,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      lastAccessedAt: session.lastAccessedAt.toISOString(),
      // Working state fields
      isWorking: session.isWorking,
      currentJobId: session.currentJobId,
      lastJobStatus: session.lastJobStatus,
    };
  }

  private normalizeProjectPath(inputPath: string): string {
    const raw = inputPath.trim();

    // Basic character allowlist to keep things sane
    if (!/^[a-zA-Z0-9._/-]+$/.test(raw)) {
      throw new ValidationError('Invalid project path');
    }

    const normalized = path.normalize(raw);

    // Must be absolute and not contain traversal after normalization
    if (!path.isAbsolute(normalized) || normalized.includes('..')) {
      throw new ValidationError('Project path must be an absolute path');
    }

    // Resolve to an absolute canonical path
    const resolved = path.resolve(normalized);
    return resolved;
  }
}

export const sessionService = new SessionService();
