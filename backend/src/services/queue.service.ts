import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { config } from '@/config';
import { db } from '@/db';
import { prompts, sessions } from '@/db/schema';
import type { PromptJobData } from '@/types';

export class QueueService {
  private queue: Queue<PromptJobData>;
  private redis: Redis;

  constructor() {
    const connection = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
    });

    this.redis = new Redis(config.REDIS_URL);
    this.queue = new Queue('claude-code-jobs', {
      connection,
      defaultJobOptions: {
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 100, // Keep last 100 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });
  }

  async addPromptJob(sessionId: string, promptId: string, prompt: string, allowedTools?: string[]) {
    // Get project path from session
    const projectPath = await this.getProjectPath(sessionId);

    // Add job to queue
    const job = await this.queue.add(
      'process-prompt',
      {
        sessionId,
        promptId,
        prompt,
        allowedTools,
        projectPath,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    // Update prompt with job ID
    await db
      .update(prompts)
      .set({
        jobId: job.id,
        status: 'processing',
      })
      .where(eq(prompts.id, promptId));

    return job.id;
  }

  async cancelJob(jobId: string, promptId: string) {
    // Get the job
    const job = await this.queue.getJob(jobId);

    if (job) {
      // Cancel the job
      await job.remove();
    }

    // Update prompt status
    await db
      .update(prompts)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
      })
      .where(eq(prompts.id, promptId));

    // Publish cancellation event
    const { sessionId } = job?.data || {};
    if (sessionId) {
      await this.publishEvent(sessionId, promptId, {
        type: 'complete',
        data: {
          type: 'complete',
          summary: {
            duration: 0,
            toolCallCount: 0,
          },
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  async publishEvent(sessionId: string, promptId: string, event: any) {
    const channel = `claude-code:${sessionId}:${promptId}`;
    await this.redis.publish(channel, JSON.stringify(event));
  }

  async getJobStatus(jobId: string) {
    const job = await this.queue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress;

    return {
      id: job.id,
      state,
      progress,
      data: job.data,
      attemptsMade: job.attemptsMade,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
    };
  }

  async getQueueMetrics() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: 0,
      total: waiting + active + delayed,
    };
  }

  private async getProjectPath(sessionId: string): Promise<string> {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      throw new Error('Session not found');
    }

    return session.projectPath;
  }

  async cleanup() {
    await this.queue.close();
    await this.redis.quit();
  }
}

export const queueService = new QueueService();
