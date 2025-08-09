import { type Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '@/config';
import { ClaudeCodeSDKService } from '@/services/claude-code-sdk.service';
import { promptService } from '@/services/prompt.service';
import type { PromptJobData } from '@/types';
import { createChildLogger } from '@/utils/logger';

const logger = createChildLogger('claude-code-worker');

/**
 * Worker for processing Claude Code prompts using CLI
 * Handles job processing, event streaming, and database updates
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
   * Main job processing function
   */
  private async processPrompt(job: Job<PromptJobData>): Promise<void> {
    const { sessionId, promptId, prompt, projectPath } = job.data;
    const channel = `claude-code:${sessionId}:${promptId}`;

    logger.info({ promptId, sessionId }, 'Processing prompt');

    try {
      await this.markPromptAsProcessing(promptId);
      await this.publishStartEvent(channel);

      // Create Claude Code SDK service instance
      const sdkService = new ClaudeCodeSDKService({
        sessionId,
        projectPath,
      });

      // Store the service for potential cleanup
      this.activeSessions.set(promptId, sdkService);

      // Set up event forwarding to Redis
      this.setupEventForwarding(sdkService, channel, job);

      // Execute the prompt
      const result = await sdkService.execute(prompt);

      // Clean up
      this.activeSessions.delete(promptId);

      // Handle result based on success/failure
      if (result.success) {
        await this.savePromptResult(promptId, result);
        await this.publishCompleteEvent(channel, result);
        logger.info({ promptId }, 'Prompt completed successfully');
      } else {
        await this.handlePromptError(promptId, channel, new Error(result.error));
        throw new Error(result.error); // Let BullMQ handle retries
      }
    } catch (error) {
      // Clean up on error
      this.activeSessions.delete(promptId);
      await this.handlePromptError(promptId, channel, error as Error);
      throw error; // Let BullMQ handle retries
    }
  }

  /**
   * Set up event forwarding from SDK service to Redis
   */
  private setupEventForwarding(
    sdkService: ClaudeCodeSDKService,
    channel: string,
    job: Job<PromptJobData>,
  ): void {
    let messageCount = 0;
    let toolCount = 0;

    // Forward assistant messages
    sdkService.on('assistant', async (data) => {
      messageCount++;
      await this.publishEvent(channel, {
        type: 'message',
        data,
      });
    });

    // Forward tool use events
    sdkService.on('tool_use', async (data) => {
      toolCount++;
      await this.publishEvent(channel, {
        type: 'tool_use',
        data,
      });

      // Update job progress
      await job.updateProgress({
        messagesProcessed: messageCount,
        toolCallCount: toolCount,
      });
    });

    // Forward tool results
    sdkService.on('tool_result', async (data) => {
      await this.publishEvent(channel, {
        type: 'tool_result',
        data,
      });
    });

    // Forward errors
    sdkService.on('error', async (data) => {
      await this.publishEvent(channel, {
        type: 'error',
        data,
      });
    });

    // Forward usage statistics
    sdkService.on('usage', async (data) => {
      await this.publishEvent(channel, {
        type: 'usage',
        data,
      });
    });

    // Log raw messages for debugging
    sdkService.on('message', (message) => {
      logger.debug({ message }, 'Raw message from Claude Code SDK');
    });
  }

  /**
   * Updates prompt status to processing
   */
  private async markPromptAsProcessing(promptId: string): Promise<void> {
    // Update the prompt status directly in the database
    const { db } = await import('@/db');
    const { prompts } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    await db.update(prompts).set({ status: 'processing' }).where(eq(prompts.id, promptId));
  }

  /**
   * Publishes the start event to Redis
   */
  private async publishStartEvent(channel: string): Promise<void> {
    await this.publishEvent(channel, {
      type: 'message',
      data: {
        type: 'message',
        content: 'Initializing Claude Code SDK...',
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Saves the prompt result to the database
   */
  private async savePromptResult(
    promptId: string,
    result: {
      success: true;
      response: string;
      duration: number;
      toolCallCount: number;
      messages: any[];
    },
  ): Promise<void> {
    // Extract tool calls from messages
    const toolCalls: any[] = [];
    for (const msg of result.messages) {
      if (msg.type === 'tool_use') {
        toolCalls.push({
          tool: msg.name || msg.tool,
          params: msg.input || msg.params,
        });
      }
    }

    await promptService.updatePromptResult(promptId, {
      response: result.response,
      status: 'completed' as const,
      metadata: {
        toolCalls,
        duration: result.duration,
        toolCallCount: result.toolCallCount,
      },
    });
  }

  /**
   * Publishes completion event with summary
   */
  private async publishCompleteEvent(
    channel: string,
    result: {
      success: true;
      duration: number;
      toolCallCount: number;
    },
  ): Promise<void> {
    await this.publishEvent(channel, {
      type: 'complete',
      data: {
        type: 'complete',
        summary: {
          duration: result.duration,
          toolCallCount: result.toolCallCount,
        },
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Handles and logs prompt processing errors
   */
  private async handlePromptError(promptId: string, channel: string, error: Error): Promise<void> {
    // Enhanced error logging with context
    const errorContext = {
      promptId,
      error: error.message,
      stack: error.stack,
      nodeEnv: process.env.NODE_ENV,
    };

    logger.error(errorContext, 'Error processing prompt');

    await promptService.updatePromptResult(promptId, {
      error: error.message,
      status: 'failed' as const,
      response: undefined,
      metadata: undefined,
    });

    await this.publishEvent(channel, {
      type: 'error',
      data: {
        type: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Publishes an event to Redis pub/sub
   */
  private async publishEvent(channel: string, event: any): Promise<void> {
    try {
      await this.redis.publish(channel, JSON.stringify(event));
    } catch (error) {
      // Log error but don't throw - stream may have already disconnected
      logger.warn(
        { channel, error, eventType: event.type },
        'Failed to publish event (client may have disconnected)',
      );
    }
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
