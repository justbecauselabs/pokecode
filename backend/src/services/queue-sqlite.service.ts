import { eq, and, lte, asc, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '@/db';
import { jobQueue, sessions } from '@/db/schema-sqlite';
import type { CompleteEvent, ErrorEvent, PromptJobData } from '@/types';
import { createChildLogger } from '@/utils/logger';

const logger = createChildLogger('sqlite-queue');

export class SQLiteQueueService {
  private processingJobs = new Set<string>();
  private isPolling = false;

  constructor() {}

  async addPromptJob(
    sessionId: string,
    promptId: string,
    prompt: string,
    allowedTools?: string[],
    messageId?: string,
  ) {
    // Get project path from session
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
      columns: { projectPath: true },
    });

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
      },
      attempts: 0,
      maxAttempts: 3,
    });

    logger.info({ jobId, promptId, sessionId }, 'Job added to queue');
    return jobId;
  }

  async cancelJob(jobId: string, promptId: string) {
    // Update job status to cancelled
    await db
      .update(jobQueue)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
      })
      .where(eq(jobQueue.id, jobId));

    // Remove from processing set if it was being processed
    this.processingJobs.delete(jobId);

    logger.info({ jobId, promptId }, 'Job cancelled');

    // Get session ID for event publishing
    const job = await db.query.jobQueue.findFirst({
      where: eq(jobQueue.id, jobId),
      columns: { sessionId: true },
    });

    if (job) {
      await this.publishEvent(job.sessionId, promptId, {
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
    const job = await db.query.jobQueue.findFirst({
      where: eq(jobQueue.id, jobId),
    });

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
    const [pending, processing, completed, failed] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(jobQueue).where(eq(jobQueue.status, 'pending')),
      db.select({ count: sql<number>`count(*)` }).from(jobQueue).where(eq(jobQueue.status, 'processing')),
      db.select({ count: sql<number>`count(*)` }).from(jobQueue).where(eq(jobQueue.status, 'completed')),
      db.select({ count: sql<number>`count(*)` }).from(jobQueue).where(eq(jobQueue.status, 'failed')),
    ]);

    return {
      waiting: pending[0]?.count ?? 0,
      active: processing[0]?.count ?? 0,
      completed: completed[0]?.count ?? 0,
      failed: failed[0]?.count ?? 0,
      delayed: 0, // SQLite doesn't have delayed jobs in this implementation
      paused: 0,
      total: (pending[0]?.count ?? 0) + (processing[0]?.count ?? 0),
    };
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
    
    // Get the oldest pending job or a job ready for retry
    const job = await db.query.jobQueue.findFirst({
      where: and(
        eq(jobQueue.status, 'pending'),
        // Either no retry time set, or retry time has passed
        sql`(${jobQueue.nextRetryAt} IS NULL OR ${jobQueue.nextRetryAt} <= ${now.getTime()})`,
      ),
      orderBy: [asc(jobQueue.createdAt)],
    });

    if (!job) {
      return null;
    }

    // Convert the data to match PromptJobData interface
    const promptJobData: PromptJobData = {
      sessionId: job.sessionId,
      promptId: job.promptId,
      prompt: job.data.prompt,
      projectPath: job.data.projectPath,
      allowedTools: job.data.allowedTools,
      messageId: job.data.messageId,
    };

    return {
      ...job,
      data: promptJobData,
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
    const job = await db.query.jobQueue.findFirst({
      where: eq(jobQueue.id, jobId),
    });

    if (!job) {
      return;
    }

    const shouldRetry = job.attempts < job.maxAttempts;
    const nextRetryAt = shouldRetry 
      ? new Date(Date.now() + Math.pow(2, job.attempts) * 2000) // Exponential backoff
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
      'Job failed, retry scheduled'
    );
  }

  // Clean up old completed/failed jobs
  async cleanup(): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    await db
      .delete(jobQueue)
      .where(
        and(
          sql`${jobQueue.status} IN ('completed', 'failed')`,
          lte(jobQueue.completedAt, thirtyDaysAgo)
        )
      );

    logger.info('Queue cleanup completed');
  }
}

export const sqliteQueueService = new SQLiteQueueService();