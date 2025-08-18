import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { sessions } from '@/db/schema-sqlite';
import { jobQueue } from '@/db/schema-sqlite/job_queue';
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
  private cancellationCheckers: Map<string, Timer> = new Map(); // Track cancellation check timers

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
      // Check if session has been cancelled before we start processing
      const hasActiveJobs = await this.hasActiveJobsForSession(sessionId);
      if (!hasActiveJobs) {
        logger.info(
          { jobId, promptId, sessionId },
          'Worker detected session cancellation before processing started',
        );
        this.processingJobs--;
        return;
      }

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

      // Store the service for potential cleanup and abortion
      this.activeSessions.set(promptId, sdkService);
      logger.debug(
        { jobId, promptId, sessionId },
        'Worker stored active SDK session for potential cancellation',
      );

      // Start periodic cancellation checking during SDK execution
      this.startCancellationChecker(jobId, promptId, sessionId, sdkService);

      // Execute the prompt (SDK saves messages directly to DB)
      logger.debug({ jobId, promptId, sessionId }, 'Worker starting Claude SDK execution');
      const result = await sdkService.execute(data.prompt);
      logger.debug(
        { jobId, promptId, sessionId, success: result.success },
        'Worker completed Claude SDK execution',
      );

      // Stop cancellation checking
      this.stopCancellationChecker(promptId);

      // Clean up
      this.activeSessions.delete(promptId);

      // Check if session was cancelled during execution
      const stillHasActiveJobs = await this.hasActiveJobsForSession(sessionId);
      if (!stillHasActiveJobs) {
        logger.info(
          { jobId, promptId, sessionId },
          'Worker detected session cancellation after SDK execution completed',
        );
        return;
      }

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
      this.stopCancellationChecker(promptId);
      this.activeSessions.delete(promptId);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check if this was a session cancellation
      const hasActiveJobsAfterError = await this.hasActiveJobsForSession(sessionId);
      if (!hasActiveJobsAfterError) {
        logger.info(
          { jobId, promptId, sessionId, error: errorMessage },
          'Worker detected session cancellation during execution (caught in error handler)',
        );
        return;
      }

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
   * Start periodic cancellation checking for a session during SDK execution
   */
  private startCancellationChecker(
    jobId: string,
    promptId: string,
    sessionId: string,
    sdkService: ClaudeCodeSDKService,
  ): void {
    const checkInterval = 2000; // Check every 2 seconds during execution

    const checker = setInterval(async () => {
      try {
        // Check if any jobs for this session have been cancelled
        const hasActiveJobs = await this.hasActiveJobsForSession(sessionId);
        if (!hasActiveJobs) {
          logger.info(
            { jobId, promptId, sessionId },
            'Worker detected session cancellation during SDK execution - aborting',
          );

          // Clear the checker first to prevent duplicate calls
          this.stopCancellationChecker(promptId);

          // Abort the SDK session
          try {
            await sdkService.abort();
            logger.info(
              { jobId, promptId, sessionId },
              'Worker successfully aborted SDK session during execution',
            );
          } catch (abortError) {
            logger.error(
              {
                jobId,
                promptId,
                sessionId,
                error: abortError instanceof Error ? abortError.message : String(abortError),
              },
              'Worker failed to abort SDK session during execution',
            );
          }

          // Clean up
          this.activeSessions.delete(promptId);
        }
      } catch (error) {
        logger.error(
          {
            jobId,
            promptId,
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Error checking session cancellation status during execution',
        );
      }
    }, checkInterval);

    this.cancellationCheckers.set(promptId, checker);
    logger.debug(
      { jobId, promptId, sessionId, checkInterval },
      'Worker started session cancellation checker',
    );
  }

  /**
   * Check if session has active (pending/processing) jobs
   */
  private async hasActiveJobsForSession(sessionId: string): Promise<boolean> {
    const activeJobCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(jobQueue)
      .where(
        and(
          eq(jobQueue.sessionId, sessionId),
          sql`${jobQueue.status} IN ('pending', 'processing')`,
        ),
      );

    return (activeJobCount[0]?.count ?? 0) > 0;
  }

  /**
   * Stop periodic cancellation checking for a job
   */
  private stopCancellationChecker(promptId: string): void {
    const checker = this.cancellationCheckers.get(promptId);
    if (checker) {
      clearInterval(checker);
      this.cancellationCheckers.delete(promptId);
      logger.debug({ promptId }, 'Worker stopped cancellation checker');
    }
  }

  /**
   * Cancel a specific session's active job
   */
  async cancelSession(promptId: string): Promise<void> {
    const sdkService = this.activeSessions.get(promptId);
    if (sdkService) {
      logger.info(
        { promptId },
        'Worker received cancellation request - aborting active SDK session',
      );
      try {
        await sdkService.abort();
        logger.info({ promptId }, 'Worker successfully aborted SDK session');
      } catch (error) {
        logger.error(
          { promptId, error: error instanceof Error ? error.message : String(error) },
          'Worker failed to abort SDK session',
        );
      }
      this.activeSessions.delete(promptId);
      this.stopCancellationChecker(promptId);
      logger.debug({ promptId }, 'Worker removed SDK session from active sessions map');
    } else {
      logger.debug(
        { promptId },
        'Worker received cancellation request but no active SDK session found',
      );
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

    // Stop all cancellation checkers
    for (const promptId of this.cancellationCheckers.keys()) {
      this.stopCancellationChecker(promptId);
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
