import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { prompts, sessions } from '@/db/schema';
import { ConflictError, NotFoundError } from '@/types';
import { queueService } from './queue.service';

export class PromptService {
  async createPrompt(
    sessionId: string,
    userId: string,
    data: {
      prompt: string;
      allowedTools?: string[];
    },
  ) {
    // Verify session ownership and status
    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, sessionId), eq(sessions.userId, userId)),
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    if (session.status !== 'active') {
      throw new ConflictError('Session is not active');
    }

    // Create prompt
    const [prompt] = await db
      .insert(prompts)
      .values({
        sessionId,
        prompt: data.prompt,
        status: 'queued',
        metadata: {
          allowedTools: data.allowedTools || session.metadata?.allowedTools,
        },
      })
      .returning();

    // Add to queue
    await queueService.addPromptJob(
      sessionId,
      prompt.id,
      prompt.prompt,
      data.allowedTools || session.metadata?.allowedTools,
    );

    // Update last accessed time for session
    await db.update(sessions).set({ lastAccessedAt: new Date() }).where(eq(sessions.id, sessionId));

    return this.formatPrompt(prompt);
  }

  async getPrompt(promptId: string, sessionId: string, userId: string) {
    // Verify session ownership
    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, sessionId), eq(sessions.userId, userId)),
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Get prompt
    const prompt = await db.query.prompts.findFirst({
      where: and(eq(prompts.id, promptId), eq(prompts.sessionId, sessionId)),
    });

    if (!prompt) {
      throw new NotFoundError('Prompt');
    }

    return this.formatPromptDetail(prompt);
  }

  async cancelPrompt(promptId: string, sessionId: string, userId: string) {
    // Verify ownership
    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, sessionId), eq(sessions.userId, userId)),
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Get prompt
    const prompt = await db.query.prompts.findFirst({
      where: and(eq(prompts.id, promptId), eq(prompts.sessionId, sessionId)),
    });

    if (!prompt) {
      throw new NotFoundError('Prompt');
    }

    // Check if prompt can be cancelled
    if (!['queued', 'processing'].includes(prompt.status)) {
      throw new ConflictError('Prompt cannot be cancelled in current state');
    }

    // Cancel job if exists
    if (prompt.jobId) {
      await queueService.cancelJob(prompt.jobId, promptId);
    } else {
      // Update status directly
      await db
        .update(prompts)
        .set({
          status: 'cancelled',
          completedAt: new Date(),
        })
        .where(eq(prompts.id, promptId));
    }

    return { success: true };
  }

  async getHistory(
    sessionId: string,
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      includeToolCalls?: boolean;
    },
  ) {
    const { limit = 20, offset = 0, includeToolCalls = false } = options;

    // Verify session ownership
    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, sessionId), eq(sessions.userId, userId)),
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(prompts)
      .where(eq(prompts.sessionId, sessionId));

    // Get prompts
    const results = await db.query.prompts.findMany({
      where: eq(prompts.sessionId, sessionId),
      orderBy: [desc(prompts.createdAt)],
      limit,
      offset,
    });

    return {
      prompts: results.map((p) => ({
        id: p.id,
        prompt: p.prompt,
        response: p.response,
        status: p.status,
        metadata: includeToolCalls ? p.metadata : undefined,
        createdAt: p.createdAt.toISOString(),
        completedAt: p.completedAt?.toISOString(),
      })),
      total: Number(count),
      limit,
      offset,
    };
  }

  async exportSession(sessionId: string, userId: string, format: 'markdown' | 'json') {
    // Verify session ownership
    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, sessionId), eq(sessions.userId, userId)),
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Get all prompts
    const allPrompts = await db.query.prompts.findMany({
      where: eq(prompts.sessionId, sessionId),
      orderBy: [prompts.createdAt],
    });

    if (format === 'json') {
      return {
        session: {
          id: session.id,
          projectPath: session.projectPath,
          context: session.context,
          createdAt: session.createdAt.toISOString(),
        },
        prompts: allPrompts.map(this.formatPromptDetail),
      };
    }

    // Markdown format
    let markdown = `# Claude Code Session\n\n`;
    markdown += `**Session ID:** ${session.id}\n`;
    markdown += `**Project Path:** ${session.projectPath}\n`;
    markdown += `**Created:** ${session.createdAt.toISOString()}\n\n`;

    if (session.context) {
      markdown += `## Context\n\n${session.context}\n\n`;
    }

    markdown += `## Conversation\n\n`;

    for (const prompt of allPrompts) {
      markdown += `### Prompt (${prompt.createdAt.toISOString()})\n\n`;
      markdown += `${prompt.prompt}\n\n`;

      if (prompt.response) {
        markdown += `### Response\n\n`;
        markdown += `${prompt.response}\n\n`;
      }

      if (prompt.error) {
        markdown += `### Error\n\n`;
        markdown += `${prompt.error}\n\n`;
      }

      markdown += `---\n\n`;
    }

    return { content: markdown, format: 'markdown' };
  }

  async updatePromptResult(
    promptId: string,
    data: {
      response?: string;
      error?: string;
      status: 'completed' | 'failed';
      metadata?: any;
    },
  ) {
    const updateData: any = {
      status: data.status,
      completedAt: new Date(),
    };

    if (data.response) {
      updateData.response = data.response;
    }
    if (data.error) {
      updateData.error = data.error;
    }
    if (data.metadata) {
      updateData.metadata = data.metadata;
    }

    await db.update(prompts).set(updateData).where(eq(prompts.id, promptId));
  }

  private formatPrompt(prompt: any) {
    return {
      id: prompt.id,
      sessionId: prompt.sessionId,
      prompt: prompt.prompt,
      status: prompt.status,
      jobId: prompt.jobId,
      createdAt: prompt.createdAt.toISOString(),
    };
  }

  private formatPromptDetail(prompt: any) {
    return {
      id: prompt.id,
      sessionId: prompt.sessionId,
      prompt: prompt.prompt,
      response: prompt.response,
      status: prompt.status,
      jobId: prompt.jobId,
      error: prompt.error,
      metadata: prompt.metadata,
      createdAt: prompt.createdAt.toISOString(),
      completedAt: prompt.completedAt?.toISOString(),
    };
  }
}

export const promptService = new PromptService();
