import { createId } from '@paralleldrive/cuid2';
import { and, asc, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { getConfig } from '../config';
import { db } from '../database';
import { jobQueue, sessions } from '../database/schema-sqlite';
import type { CompleteEvent, ErrorEvent, PromptJobData } from '../types';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('sqlite-queue');

export class SQLiteQueueService {
  private processingJobs = new Set<string>();

  async addPromptJob(
    sessionId: string,
    promptId: string,
    prompt: string,
    allowedTools?: string[],
    messageId?: string,
    model?: string,
  ) {
    // Get project path from session
    const session = await db
      .select({ projectPath: sessions.projectPath })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .get();

    if (!session) {
      throw new Error('Session not found');
    }

    // Add job to queue
    const jobId = createId();
    await db.insert(jobQueue).values({
      id: jobId,
      sessionId,
      promptId,
      status: 'pending',
      data: {
        prompt,
        projectPath: session.projectPath,
        ...(allowedTools !== undefined && { allowedTools }),
        ...(messageId !== undefined && { messageId }),
        ...(model !== undefined && { model }),
      },
      attempts: 0,
      maxAttempts: 1, // Default, can be overridden by config
    });

    logger.info({ jobId, promptId, sessionId }, 'Job added to queue');
    return jobId;
  }

  async cancelJobsForSession(sessionId: string) {
    logger.info({ sessionId }, 'Queue service received session cancellation request');

    // Get all active jobs for this session
    const activeJobs = await db
      .select({ id: jobQueue.id, promptId: jobQueue.promptId })
      .from(jobQueue)
      .where(
        and(
          eq(jobQueue.sessionId, sessionId),
          sql`${jobQueue.status} IN ('pending', 'processing')`,
        ),
      );

    if (activeJobs.length === 0) {
      logger.debug({ sessionId }, 'No active jobs found for session');
      return;
    }

    logger.info({ sessionId, jobCount: activeJobs.length }, 'Cancelling active jobs for session');

    // Update all active jobs to cancelled
    await db
      .update(jobQueue)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
      })
      .where(
        and(
          eq(jobQueue.sessionId, sessionId),
          sql`${jobQueue.status} IN ('pending', 'processing')`,
        ),
      );

    // Remove from processing set
    for (const job of activeJobs) {
      this.processingJobs.delete(job.id);
    }

    logger.info(
      { sessionId, cancelledJobs: activeJobs.length },
      'Queue service marked all session jobs as cancelled',
    );

    // Publish completion events for all cancelled jobs
    for (const job of activeJobs) {
      await this.publishEvent(sessionId, job.promptId, {
        type: 'complete',
        summary: {
          duration: 0,
          toolCallCount: 0,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getJobStatus(jobId: string) {
    const job = await db.select().from(jobQueue).where(eq(jobQueue.id, jobId)).get();

    if (!job) {
      return null;
    }

    return {
      id: job.id,
      state: job.status,
      progress: job.status === 'processing' ? 50 : job.status === 'completed' ? 100 : 0,
      data: job.data,
      attemptsMade: job.attempts,
      finishedOn: job.completedAt,
      failedReason: job.error,
    };
  }

  async getQueueMetrics() {
    try {
      logger.debug('Getting queue metrics from database');
      const [pending, processing, completed, failed] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(jobQueue)
          .where(eq(jobQueue.status, 'pending')),
        db
          .select({ count: sql<number>`count(*)` })
          .from(jobQueue)
          .where(eq(jobQueue.status, 'processing')),
        db
          .select({ count: sql<number>`count(*)` })
          .from(jobQueue)
          .where(eq(jobQueue.status, 'completed')),
        db
          .select({ count: sql<number>`count(*)` })
          .from(jobQueue)
          .where(eq(jobQueue.status, 'failed')),
      ]);
      logger.debug('Successfully retrieved queue metrics from database');

      return {
        waiting: pending[0]?.count ?? 0,
        active: processing[0]?.count ?? 0,
        completed: completed[0]?.count ?? 0,
        failed: failed[0]?.count ?? 0,
        delayed: 0, // SQLite doesn't have delayed jobs in this implementation
        paused: 0,
        total: (pending[0]?.count ?? 0) + (processing[0]?.count ?? 0),
      };
    } catch (error) {
      logger.error(
        {
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  stack: error.stack,
                  name: error.name,
                }
              : error,
        },
        'Failed to get queue metrics',
      );
      throw error;
    }
  }

  async publishEvent(sessionId: string, promptId: string, event: CompleteEvent | ErrorEvent) {
    // For now, we'll just log the event. In production, you might want to:
    // 1. Store events in a separate table for pub/sub simulation
    // 2. Use server-sent events to push to clients
    // 3. Use WebSocket connections for real-time updates
    logger.info({ sessionId, promptId, event }, 'Publishing event');
  }

  // Get the next available job for processing
  async getNextJob(): Promise<(typeof jobQueue.$inferSelect & { data: PromptJobData }) | null> {
    const now = new Date();

    logger.info({}, 'Getting next job');

    // Get the oldest pending job or a job ready for retry
    const job = await db
      .select()
      .from(jobQueue)
      .where(
        and(
          eq(jobQueue.status, 'pending'),
          // Either no retry time set, or retry time has passed
          or(isNull(jobQueue.nextRetryAt), lte(jobQueue.nextRetryAt, now)),
        ),
      )
      .orderBy(asc(jobQueue.createdAt))
      .limit(1)
      .get();

    if (!job) {
      return null;
    }

    return this.convertJobToPromptData(job);
  }

  private convertJobToPromptData(
    job: typeof jobQueue.$inferSelect,
  ): typeof jobQueue.$inferSelect & { data: PromptJobData } {
    // Convert the data to match PromptJobData interface
    const promptJobData: PromptJobData = {
      sessionId: job.sessionId,
      promptId: job.promptId,
      prompt: job.data.prompt,
      projectPath: job.data.projectPath,
      ...(job.data.allowedTools !== undefined && { allowedTools: job.data.allowedTools }),
      ...(job.data.messageId !== undefined && { messageId: job.data.messageId }),
      ...(job.data.model !== undefined && { model: job.data.model }),
    };

    return {
      id: job.id,
      sessionId: job.sessionId,
      promptId: job.promptId,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      nextRetryAt: job.nextRetryAt,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      data: {
        sessionId: promptJobData.sessionId,
        promptId: promptJobData.promptId,
        prompt: promptJobData.prompt,
        projectPath: promptJobData.projectPath,
        ...(promptJobData.allowedTools !== undefined && {
          allowedTools: promptJobData.allowedTools,
        }),
        ...(promptJobData.messageId !== undefined && { messageId: promptJobData.messageId }),
        ...(promptJobData.model !== undefined && { model: promptJobData.model }),
      },
    };
  }

  // Mark a job as processing
  async markJobProcessing(jobId: string): Promise<void> {
    await db
      .update(jobQueue)
      .set({
        status: 'processing',
        startedAt: new Date(),
        attempts: sql`${jobQueue.attempts} + 1`,
      })
      .where(eq(jobQueue.id, jobId));

    this.processingJobs.add(jobId);
  }

  // Mark a job as completed
  async markJobCompleted(jobId: string): Promise<void> {
    await db
      .update(jobQueue)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(jobQueue.id, jobId));

    this.processingJobs.delete(jobId);
  }

  // Mark a job as failed and handle retry logic
  async markJobFailed(jobId: string, error: string): Promise<void> {
    const job = await db.select().from(jobQueue).where(eq(jobQueue.id, jobId)).get();

    if (!job) {
      return;
    }

    const shouldRetry = job.attempts < job.maxAttempts;
    const nextRetryAt = shouldRetry
      ? new Date(Date.now() + 2 ** job.attempts * 2000) // Exponential backoff
      : null;

    await db
      .update(jobQueue)
      .set({
        status: shouldRetry ? 'pending' : 'failed',
        error,
        nextRetryAt,
        ...(shouldRetry ? {} : { completedAt: new Date() }),
      })
      .where(eq(jobQueue.id, jobId));

    this.processingJobs.delete(jobId);

    logger.info(
      { jobId, attempts: job.attempts, maxAttempts: job.maxAttempts, shouldRetry },
      'Job failed, retry scheduled',
    );
  }

  // Clean up old completed/failed jobs
  async cleanup(): Promise<void> {
    const config = await getConfig();
    const retentionDaysAgo = new Date(Date.now() - config.jobRetention * 24 * 60 * 60 * 1000);

    await db
      .delete(jobQueue)
      .where(
        and(
          sql`${jobQueue.status} IN ('completed', 'failed')`,
          lte(jobQueue.completedAt, retentionDaysAgo),
        ),
      );

    logger.info('Queue cleanup completed');
  }
}

export const sqliteQueueService = new SQLiteQueueService();
