import { randomUUID } from 'node:crypto';
import type { AgentRunner } from '@pokecode/core';
import {
  ClaudeCodeRunner,
  CodexRunner,
  createChildLogger,
  db,
  emitSessionDone,
  jobQueue,
  messageService,
  sessions,
  sqliteQueueService,
} from '@pokecode/core';
import { and, eq, sql } from 'drizzle-orm';

const logger = createChildLogger('agent-runner-worker');

export class AgentRunnerWorker {
  private isRunning = false;
  private pollingInterval = 1000;
  private concurrency = 5;
  private activeSessions: Map<string, AgentRunner> = new Map();
  private processingJobs = 0;
  private pollingTimer: ReturnType<typeof setTimeout> | null = null;
  private cancellationCheckers: Map<string, ReturnType<typeof setInterval>> = new Map();

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info({ concurrency: this.concurrency }, 'Starting Agent Runner worker');
    this.startPolling();
  }

  private startPolling(): void {
    const poll = async () => {
      if (!this.isRunning) return;
      try {
        if (this.processingJobs < this.concurrency) {
          const job = await sqliteQueueService.getNextJob();
          if (job) {
            this.processJob(job).catch((error) => {
              logger.error({ error, jobId: job.id }, 'Error processing job');
            });
          }
        }
      } catch (error) {
        logger.error({ error }, 'Error in polling loop');
      }
      if (this.isRunning) this.pollingTimer = setTimeout(poll, this.pollingInterval);
    };
    poll();
  }

  private async processJob(
    job: Awaited<ReturnType<typeof sqliteQueueService.getNextJob>>,
  ): Promise<void> {
    if (!job) return;
    const { id: jobId, sessionId, promptId, data } = job;
    this.processingJobs++;
    logger.info({ jobId, promptId, sessionId, attempts: job.attempts }, 'Processing job');
    try {
      const hasActiveJobs = await this.hasActiveJobsForSession(sessionId);
      if (!hasActiveJobs) {
        logger.info({ jobId, promptId, sessionId }, 'Session cancelled before processing');
        this.processingJobs--;
        return;
      }
      await sqliteQueueService.markJobProcessing(jobId);
      await db
        .update(sessions)
        .set({
          isWorking: true,
          currentJobId: promptId,
          lastJobStatus: 'processing',
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, sessionId));

      const model = data.model || 'sonnet';
      let runner: AgentRunner;
      if (job.provider === 'claude-code') {
        runner = new ClaudeCodeRunner({
          sessionId,
          projectPath: data.projectPath,
          messageService,
          model,
        });
      } else if (job.provider === 'codex-cli') {
        runner = new CodexRunner({
          sessionId,
          projectPath: data.projectPath,
          model,
        });
      } else {
        throw new Error(`Unsupported provider: ${job.provider}`);
      }

      this.activeSessions.set(promptId, runner);
      this.startCancellationChecker(jobId, promptId, sessionId, runner);

      const abortController = new AbortController();
      const started = Date.now();
      try {
        for await (const item of runner.execute({
          sessionId,
          projectPath: data.projectPath,
          prompt: data.prompt,
          model,
          abortController,
        })) {
          await messageService.saveSDKMessage({
            sessionId,
            sdkMessage: item.message,
            ...(item.providerSessionId ? { providerSessionId: item.providerSessionId } : {}),
            provider: item.provider,
          });
        }
      } finally {
        this.stopCancellationChecker(promptId);
        this.activeSessions.delete(promptId);
      }

      const stillHasActive = await this.hasActiveJobsForSession(sessionId);
      if (!stillHasActive) {
        logger.info({ jobId, promptId, sessionId }, 'Session cancelled after execution');
        await this.saveCancellationMessage(sessionId, 'Operation was cancelled by user');
        return;
      }

      await sqliteQueueService.markJobCompleted(jobId);
      await db
        .update(sessions)
        .set({
          isWorking: false,
          currentJobId: null,
          lastJobStatus: 'completed',
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, sessionId));
      emitSessionDone(sessionId);
      await sqliteQueueService.publishEvent(sessionId, promptId, {
        type: 'complete',
        summary: { duration: Date.now() - started, toolCallCount: 0 },
        timestamp: new Date().toISOString(),
      });
      logger.info(
        { jobId, promptId, durationMs: Date.now() - started },
        'Job completed successfully',
      );
    } catch (error) {
      this.stopCancellationChecker(promptId);
      this.activeSessions.delete(promptId);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await sqliteQueueService.markJobFailed(jobId, errorMessage);
      await db
        .update(sessions)
        .set({
          isWorking: false,
          currentJobId: null,
          lastJobStatus: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, sessionId));
      emitSessionDone(sessionId);
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

  private startCancellationChecker(
    jobId: string,
    promptId: string,
    sessionId: string,
    runner: AgentRunner,
  ): void {
    const checkInterval = 2000;
    const checker = setInterval(async () => {
      try {
        const hasActiveJobs = await this.hasActiveJobsForSession(sessionId);
        if (!hasActiveJobs) {
          logger.info({ jobId, promptId, sessionId }, 'Cancelling active runner');
          this.stopCancellationChecker(promptId);
          try {
            await runner.abort();
          } catch (abortError) {
            logger.error({ jobId, promptId, sessionId, error: abortError }, 'Abort failed');
          }
          this.activeSessions.delete(promptId);
        }
      } catch (error) {
        logger.error({ jobId, promptId, sessionId, error }, 'Error checking cancellation');
      }
    }, checkInterval);
    this.cancellationCheckers.set(promptId, checker);
  }

  private async saveCancellationMessage(sessionId: string, message: string): Promise<void> {
    try {
      const model = 'sonnet';
      const cancellationMessage = {
        type: 'assistant' as const,
        message: {
          role: 'assistant' as const,
          content: [
            {
              type: 'text' as const,
              text: `❌ **Operation Cancelled**\n\n${message}`,
              citations: null,
            },
          ],
          id: `cancelled_${Date.now()}`,
          type: 'message' as const,
          model,
          stop_reason: null,
          stop_sequence: null,
          usage: {
            cache_creation: null,
            cache_creation_input_tokens: null,
            cache_read_input_tokens: null,
            input_tokens: 0,
            output_tokens: 0,
            server_tool_use: null,
            service_tier: null,
          },
        },
        parent_tool_use_id: null,
        session_id: sessionId,
        uuid: randomUUID(),
      };
      await messageService.saveSDKMessage({ sessionId, sdkMessage: cancellationMessage });
    } catch (error) {
      logger.error({ sessionId, error }, 'Failed to save cancellation message');
    }
  }

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

  private stopCancellationChecker(promptId: string): void {
    const checker = this.cancellationCheckers.get(promptId);
    if (checker) {
      clearInterval(checker);
      this.cancellationCheckers.delete(promptId);
    }
  }

  async cancelSession(promptId: string): Promise<void> {
    const runner = this.activeSessions.get(promptId);
    if (runner) {
      try {
        await runner.abort();
      } catch {
        // ignore
      }
      this.activeSessions.delete(promptId);
      this.stopCancellationChecker(promptId);
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Agent Runner worker...');
    this.isRunning = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
    for (const promptId of this.cancellationCheckers.keys()) {
      this.stopCancellationChecker(promptId);
    }
    for (const [_promptId, runner] of this.activeSessions) {
      try {
        await runner.abort();
      } catch {
        // ignore
      }
    }
    this.activeSessions.clear();
    logger.info('Agent Runner worker shutdown complete');
  }

  async getMetrics() {
    return {
      isRunning: this.isRunning,
      isPaused: false,
      concurrency: this.concurrency,
      activeSessions: this.activeSessions.size,
      processingJobs: this.processingJobs,
    };
  }

  async cleanup(): Promise<void> {
    await sqliteQueueService.cleanup();
  }
}
