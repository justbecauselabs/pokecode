import { type Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { config } from '@/config';
import { db } from '@/db';
import { sessions } from '@/db/schema';
import { ClaudeCodeSDKService } from '@/services/claude-code-sdk.service';
import { messageService } from '@/services/message.service';
import type { PromptJobData } from '@/types';
import { createChildLogger } from '@/utils/logger';

const logger = createChildLogger('claude-code-worker');

/**
 * Simplified worker for processing Claude Code prompts
 * SDK handles message saving directly to database
 */
export class ClaudeCodeWorker {
  private worker: Worker<PromptJobData>;
  private redis: Redis;
  private readonly concurrency: number = 5;
  private activeSessions: Map<string, ClaudeCodeSDKService> = new Map();

  constructor() {
    this.redis = new Redis(config.REDIS_URL);
    this.worker = this.createWorker();
    this.setupEventHandlers();
  }

  /**
   * Creates and configures the BullMQ worker
   */
  private createWorker(): Worker<PromptJobData> {
    return new Worker<PromptJobData>('claude-code-jobs', async (job) => this.processPrompt(job), {
      connection: new Redis(config.REDIS_URL, {
        maxRetriesPerRequest: null,
      }),
      concurrency: this.concurrency,
      removeOnComplete: { count: 100, age: 24 * 3600 },
      removeOnFail: { count: 500, age: 7 * 24 * 3600 },
    });
  }

  /**
   * Sets up worker event handlers for monitoring
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      logger.info({ jobId: job.id }, 'Job completed successfully');
    });

    this.worker.on('failed', (job, error) => {
      logger.error({ jobId: job?.id, error: error.message }, 'Job failed');
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn({ jobId }, 'Job stalled');
    });

    this.worker.on('progress', (job, progress) => {
      logger.debug({ jobId: job.id, progress }, 'Job progress');
    });
  }

  /**
   * Simplified job processing function
   * SDK handles message saving directly
   */
  private async processPrompt(job: Job<PromptJobData>): Promise<void> {
    const { sessionId, promptId, prompt, projectPath } = job.data;

    logger.info({ promptId, sessionId }, 'Processing prompt');

    try {
      // Look up existing Claude Code session ID and update working state
      const session = await db.query.sessions.findFirst({
        where: eq(sessions.id, sessionId),
        columns: { claudeCodeSessionId: true, projectPath: true },
      });

      // Update session working state to indicate job is running
      await db
        .update(sessions)
        .set({
          isWorking: true,
          currentJobId: promptId,
          lastJobStatus: 'processing',
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, sessionId));

      // Create Claude Code SDK service instance with message service
      const sdkService = new ClaudeCodeSDKService({
        sessionId,
        projectPath,
        claudeCodeSessionId: session?.claudeCodeSessionId ?? null,
        messageService, // Inject message service for direct saving
      });

      // Store the service for potential cleanup
      this.activeSessions.set(promptId, sdkService);

      // Execute the prompt (SDK saves messages directly to DB)
      const result = await sdkService.execute(prompt);

      // Clean up
      this.activeSessions.delete(promptId);

      // Handle result based on success/failure
      if (result.success) {
        // Update session working state to indicate completion
        await db
          .update(sessions)
          .set({
            isWorking: false,
            currentJobId: null,
            lastJobStatus: 'completed',
            updatedAt: new Date(),
          })
          .where(eq(sessions.id, sessionId));

        logger.info({ promptId, duration: result.duration }, 'Prompt completed successfully');
      } else {
        await this.handlePromptError(promptId, sessionId, new Error(result.error));
        throw new Error(result.error);
      }
    } catch (error) {
      // Clean up on error
      this.activeSessions.delete(promptId);
      await this.handlePromptError(promptId, sessionId, error as Error);
      throw error;
    }
  }

  /**
   * Handles and logs prompt processing errors
   */
  private async handlePromptError(
    promptId: string,
    sessionId: string,
    error: Error,
  ): Promise<void> {
    // Enhanced error logging with context
    const errorContext = {
      promptId,
      sessionId,
      error: error.message,
      stack: error.stack,
      nodeEnv: process.env.NODE_ENV,
    };

    logger.error(errorContext, 'Error processing prompt');

    // Update session working state to indicate failure
    await db
      .update(sessions)
      .set({
        isWorking: false,
        currentJobId: null,
        lastJobStatus: 'failed',
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));
  }

  /**
   * Starts the worker
   */
  async start(): Promise<void> {
    // Worker is already running when created with a process function
    if (!this.worker.isRunning()) {
      await this.worker.run();
    }
  }

  /**
   * Gracefully shuts down the worker
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down worker...');

    // Abort any active SDK sessions
    for (const [promptId, sdkService] of this.activeSessions) {
      logger.info({ promptId }, 'Aborting active SDK session');
      await sdkService.abort();
    }
    this.activeSessions.clear();

    await this.worker.close();
    await this.redis.quit();
    logger.info('Worker shutdown complete');
  }

  /**
   * Gets worker metrics for monitoring
   */
  async getMetrics() {
    return {
      isRunning: this.worker.isRunning(),
      isPaused: this.worker.isPaused(),
      concurrency: this.concurrency,
      activeSessions: this.activeSessions.size,
    };
  }
}
