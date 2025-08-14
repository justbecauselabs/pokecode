import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { sessions } from '@/db/schema-sqlite';
import { ClaudeCodeSDKService } from '@/services/claude-code-sdk.service';
import { messageService } from '@/services/message.service';
import { sqliteQueueService } from '@/services/queue-sqlite.service';
import { createChildLogger } from '@/utils/logger';

const logger = createChildLogger('claude-code-sqlite-worker');

/**
 * SQLite-based worker for processing Claude Code prompts
 * Uses polling instead of Redis for job management
 */
export class ClaudeCodeSQLiteWorker {
  private isRunning = false;
  private readonly pollingInterval = 1000; // 1 second
  private readonly concurrency = 5;
  private activeSessions: Map<string, ClaudeCodeSDKService> = new Map();
  private processingJobs = 0;
  private pollingTimer: Timer | null = null;

  /**
   * Starts the worker polling loop
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    logger.info({ concurrency: this.concurrency }, 'Starting SQLite worker');

    // Start the polling loop
    this.startPolling();
  }

  /**
   * Starts the job polling mechanism
   */
  private startPolling(): void {
    const poll = async () => {
      if (!this.isRunning) {
        return;
      }

      try {
        // Only process if we have capacity
        if (this.processingJobs < this.concurrency) {
          const job = await sqliteQueueService.getNextJob();

          if (job) {
            // Process job in background (don't await)
            this.processJob(job).catch((error) => {
              logger.error({ error, jobId: job.id }, 'Error processing job');
            });
          }
        }
      } catch (error) {
        logger.error({ error }, 'Error in polling loop');
      }

      // Schedule next poll
      if (this.isRunning) {
        this.pollingTimer = setTimeout(poll, this.pollingInterval);
      }
    };

    // Start polling
    poll();
  }

  /**
   * Processes a single job
   */
  private async processJob(
    job: Awaited<ReturnType<typeof sqliteQueueService.getNextJob>>,
  ): Promise<void> {
    if (!job) return;

    const { id: jobId, sessionId, promptId, data } = job;
    this.processingJobs++;

    logger.info({ jobId, promptId, sessionId, attempts: job.attempts }, 'Processing job');

    try {
      // Mark job as processing
      await sqliteQueueService.markJobProcessing(jobId);

      // Update session working state
      await db
        .update(sessions)
        .set({
          isWorking: true,
          currentJobId: promptId,
          lastJobStatus: 'processing',
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, sessionId));

      // Create Claude Code SDK service instance
      const sdkService = new ClaudeCodeSDKService({
        sessionId,
        projectPath: data.projectPath,
        messageService, // Inject message service for direct saving
      });

      // Store the service for potential cleanup
      this.activeSessions.set(promptId, sdkService);

      // Execute the prompt (SDK saves messages directly to DB)
      const result = await sdkService.execute(data.prompt);

      // Clean up
      this.activeSessions.delete(promptId);

      if (result.success) {
        // Mark job as completed
        await sqliteQueueService.markJobCompleted(jobId);

        // Update session working state
        await db
          .update(sessions)
          .set({
            isWorking: false,
            currentJobId: null,
            lastJobStatus: 'completed',
            updatedAt: new Date(),
          })
          .where(eq(sessions.id, sessionId));

        // Publish completion event
        await sqliteQueueService.publishEvent(sessionId, promptId, {
          type: 'complete',
          summary: {
            duration: result.duration || 0,
            toolCallCount: 0, // TODO: Extract from result if available
          },
          timestamp: new Date().toISOString(),
        });

        logger.info({ jobId, promptId, duration: result.duration }, 'Job completed successfully');
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      // Clean up on error
      this.activeSessions.delete(promptId);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Mark job as failed (handles retry logic)
      await sqliteQueueService.markJobFailed(jobId, errorMessage);

      // Update session working state
      await db
        .update(sessions)
        .set({
          isWorking: false,
          currentJobId: null,
          lastJobStatus: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, sessionId));

      // Publish error event
      await sqliteQueueService.publishEvent(sessionId, promptId, {
        type: 'error',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      logger.error({ jobId, promptId, error: errorMessage }, 'Job failed');
    } finally {
      this.processingJobs--;
    }
  }

  /**
   * Gracefully shuts down the worker
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down SQLite worker...');

    this.isRunning = false;

    // Clear polling timer
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }

    // Abort any active SDK sessions
    for (const [promptId, sdkService] of this.activeSessions) {
      logger.info({ promptId }, 'Aborting active SDK session');
      await sdkService.abort();
    }
    this.activeSessions.clear();

    // Wait for any remaining jobs to finish (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.processingJobs > 0 && Date.now() - startTime < shutdownTimeout) {
      logger.info({ processingJobs: this.processingJobs }, 'Waiting for jobs to complete...');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (this.processingJobs > 0) {
      logger.warn(
        { processingJobs: this.processingJobs },
        'Force shutdown with jobs still processing',
      );
    }

    logger.info('SQLite worker shutdown complete');
  }

  /**
   * Gets worker metrics for monitoring
   */
  async getMetrics() {
    return {
      isRunning: this.isRunning,
      isPaused: false,
      concurrency: this.concurrency,
      activeSessions: this.activeSessions.size,
      processingJobs: this.processingJobs,
    };
  }

  /**
   * Cleanup old jobs (should be called periodically)
   */
  async cleanup(): Promise<void> {
    await sqliteQueueService.cleanup();
  }
}
