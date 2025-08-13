import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { sessions } from '@/db/schema-sqlite';
import ClaudeDirectoryService from '@/services/claude-directory.service';
import { repositoryService } from '@/services/repository.service';
import { NotFoundError, ValidationError } from '@/types';
import { logger } from '@/utils/logger';

export class SessionService {
  async createSession(data: {
    projectPath?: string;
    folderName?: string;
    context?: string;
    metadata?: Record<string, unknown>;
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
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new ValidationError(`Invalid repository folder: ${message}`);
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

    // Extract name from the project path (last path component)
    const name = this.extractNameFromPath(projectPath);

    // Create the session with all required data in a single operation
    const result = await db
      .insert(sessions)
      .values({
        id: sessionId,
        projectPath,
        name,
        claudeDirectoryPath,
        ...(data.context !== undefined && { context: data.context }),
        ...(data.metadata !== undefined && { metadata: data.metadata }),
      })
      .returning();

    const session = result[0];
    if (!session) {
      throw new ValidationError('Failed to create session');
    }

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
    options: { status?: 'active' | 'idle' | 'expired'; limit?: number; offset?: number } = {},
  ) {
    logger.info({ options }, 'Listing sessions');

    const { limit = 20, offset = 0 } = options;
    // Always enforce a maximum limit of 20 sessions
    const effectiveLimit = Math.min(limit, 20);

    // Build where clause - show all sessions (including those without Claude Code session IDs yet)
    const whereClause = sql`1=1`;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(whereClause);
    const count = countResult[0]?.count ?? 0;

    // Get sessions ordered by updated_at descending
    const results = await db.query.sessions.findMany({
      where: whereClause,
      orderBy: [desc(sessions.updatedAt)],
      limit: effectiveLimit,
      offset,
    });

    logger.info({ results }, 'Sessions listed');

    // Format sessions and apply status filter if needed
    let formattedSessions = results.map((session) => this.formatSession(session));

    if (options.status) {
      formattedSessions = formattedSessions.filter((session) => session.status === options.status);
    }

    return {
      sessions: formattedSessions,
      total: Number(count),
      limit: effectiveLimit,
      offset,
    };
  }

  async updateSession(
    sessionId: string,
    data: {
      context?: string;
      metadata?: Record<string, unknown>;
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
    // Get all sessions and compute active ones based on updated_at
    const allSessions = await db.query.sessions.findMany();

    const activeSessions = allSessions.filter(
      (session) => this.computeSessionStatus(session.updatedAt) === 'active',
    );

    return activeSessions.length;
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
    return await claudeService.getProjectConversations(session.projectPath);
  }

  /**
   * Get the most recent conversation for a session
   */
  async getMostRecentConversation(sessionId: string) {
    const session = await this.getSession(sessionId);

    if (!session.claudeDirectoryPath) {
      throw new ValidationError('Session does not have Claude directory path configured');
    }

    const claudeService = ClaudeDirectoryService.forSessionDirectory(session.claudeDirectoryPath);
    return await claudeService.getMostRecentConversation(session.projectPath);
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
    return await claudeService.isInitialized();
  }

  private formatSession(session: typeof sessions.$inferSelect) {
    return {
      id: session.id,
      projectPath: session.projectPath,
      name: session.name,
      claudeDirectoryPath: session.claudeDirectoryPath,
      context: session.context,
      status: this.computeSessionStatus(session.updatedAt),
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

  private computeSessionStatus(updatedAt: Date): 'active' | 'idle' | 'expired' {
    const now = new Date();
    const timeDiff = now.getTime() - updatedAt.getTime();
    const hoursAgo = timeDiff / (1000 * 60 * 60);

    if (hoursAgo < 1) {
      return 'active';
    } else if (hoursAgo < 3) {
      return 'idle';
    } else {
      return 'expired';
    }
  }

  private extractNameFromPath(projectPath: string): string {
    // Remove trailing slashes
    const cleaned = projectPath.replace(/\/+$/, '');

    // Try to find git repository root
    const gitRoot = this.findGitRoot(cleaned);

    if (gitRoot) {
      // Get the repository name from the git root directory
      const repoName = path.basename(gitRoot);

      // If the project path is the same as git root, just use repo name
      if (cleaned === gitRoot) {
        return repoName;
      }

      // Otherwise, create relative path from git root
      const relativePath = path.relative(gitRoot, cleaned);
      return `${repoName}/${relativePath}`;
    }

    // Fallback to just the directory name if no git root found
    const name = path.basename(cleaned);
    return name || 'root';
  }

  private findGitRoot(startPath: string): string | null {
    let currentPath = startPath;

    // Walk up the directory tree looking for .git directory
    while (currentPath !== path.dirname(currentPath)) {
      try {
        const gitPath = path.join(currentPath, '.git');
        if (fs.existsSync(gitPath)) {
          return currentPath;
        }
      } catch (_error) {
        // Continue if we can't access the directory
      }
      currentPath = path.dirname(currentPath);
    }

    return null; // No git root found
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
