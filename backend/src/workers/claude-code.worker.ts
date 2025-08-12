import { type Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { config } from '@/config';
import { db } from '@/db';
import { sessions } from '@/db/schema';
import { ClaudeCodeSDKService } from '@/services/claude-code-sdk.service';
import { messageService } from '@/services/message.service';
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
    const { sessionId, promptId, prompt, projectPath, messageId } = job.data;
    const channel = `claude-code:${sessionId}:${promptId}`;

    logger.info({ promptId, sessionId }, 'Processing prompt');

    try {
      await this.markPromptAsProcessing(promptId);
      await this.publishStartEvent(channel);

      // Look up existing Claude Code session ID (if any) and update working state
      const session = await db.query.sessions.findFirst({
        where: eq(sessions.id, sessionId),
        columns: { claudeCodeSessionId: true },
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

      // Create Claude Code SDK service instance
      const sdkService = new ClaudeCodeSDKService({
        sessionId,
        projectPath,
        claudeCodeSessionId: session?.claudeCodeSessionId ?? null,
      });

      // Store the service for potential cleanup
      this.activeSessions.set(promptId, sdkService);

      // Set up event forwarding to Redis
      this.setupEventForwarding(sdkService, channel, job);

      // Handle Claude Code session ID capture for database backfill
      sdkService.on(
        'claude_session_captured',
        async (data: { databaseSessionId: string; claudeCodeSessionId: string }) => {
          try {
            await this.backfillClaudeSessionId(data.databaseSessionId, data.claudeCodeSessionId);

            // Also update the user message with the claude session ID if messageId is provided
            if (messageId) {
              await messageService.updateClaudeSessionId(messageId, data.claudeCodeSessionId);
              logger.debug(
                { messageId, claudeCodeSessionId: data.claudeCodeSessionId },
                'Updated user message with Claude session ID',
              );
            }
          } catch (error) {
            logger.warn(
              {
                databaseSessionId: data.databaseSessionId,
                claudeCodeSessionId: data.claudeCodeSessionId,
                messageId,
                error: error instanceof Error ? error.message : String(error),
              },
              'Failed to backfill Claude session ID or update message',
            );
          }
        },
      );

      // Execute the prompt
      // Note: Claude Code SDK automatically stores conversation data in ~/.claude directory
      // We only need to track job metadata in our database
      const result = await sdkService.execute(prompt);

      // Clean up
      this.activeSessions.delete(promptId);

      // Handle result based on success/failure
      if (result.success) {
        await this.savePromptResult(promptId, result);
        await this.publishCompleteEvent(channel, result);

        // Create assistant message if messageId is provided
        if (messageId) {
          try {
            const assistantMessage = await messageService.createMessage({
              sessionId,
              text: result.response || 'Command completed successfully',
              type: 'assistant',
              claudeSessionId:
                (
                  await db.query.sessions.findFirst({
                    where: eq(sessions.id, sessionId),
                    columns: { claudeCodeSessionId: true },
                  })
                )?.claudeCodeSessionId || undefined,
            });
            logger.debug(
              { messageId, assistantMessageId: assistantMessage.id },
              'Created assistant message for completed prompt',
            );
          } catch (error) {
            logger.warn(
              {
                messageId,
                sessionId,
                error: error instanceof Error ? error.message : String(error),
              },
              'Failed to create assistant message',
            );
          }
        }

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

        logger.info({ promptId }, 'Prompt completed successfully');
      } else {
        await this.handlePromptError(promptId, sessionId, channel, new Error(result.error));
        throw new Error(result.error); // Let BullMQ handle retries
      }
    } catch (error) {
      // Clean up on error
      this.activeSessions.delete(promptId);
      await this.handlePromptError(promptId, sessionId, channel, error as Error);
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
    let blockCount = 0;

    // Forward streaming events
    sdkService.on('message_start', async (data) => {
      await this.publishEvent(channel, {
        type: 'message_start',
        data,
      });
    });

    sdkService.on('content_block_start', async (data) => {
      blockCount++;
      await this.publishEvent(channel, {
        type: 'content_block_start',
        data,
      });
    });

    sdkService.on('text_delta', async (data) => {
      await this.publishEvent(channel, {
        type: 'text_delta',
        data,
      });
    });

    sdkService.on('thinking_delta', async (data) => {
      await this.publishEvent(channel, {
        type: 'thinking_delta',
        data,
      });
    });

    sdkService.on('citations_delta', async (data) => {
      await this.publishEvent(channel, {
        type: 'citations_delta',
        data,
      });
    });

    sdkService.on('content_block_delta', async (data) => {
      await this.publishEvent(channel, {
        type: 'content_block_delta',
        data,
      });
    });

    sdkService.on('content_block_stop', async (data) => {
      await this.publishEvent(channel, {
        type: 'content_block_stop',
        data,
      });
    });

    sdkService.on('message_delta', async (data) => {
      await this.publishEvent(channel, {
        type: 'message_delta',
        data,
      });
    });

    sdkService.on('message_stop', async (data) => {
      await this.publishEvent(channel, {
        type: 'message_stop',
        data,
      });
    });

    // Forward assistant messages (legacy compatibility)
    sdkService.on('assistant', async (data) => {
      messageCount++;
      await this.publishEvent(channel, {
        type: 'message',
        data,
      });
    });

    // Forward thinking content
    sdkService.on('thinking', async (data) => {
      await this.publishEvent(channel, {
        type: 'thinking',
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
        blockCount,
      });
    });

    // Forward server tool use events
    sdkService.on('server_tool_use', async (data) => {
      toolCount++;
      await this.publishEvent(channel, {
        type: 'server_tool_use',
        data,
      });
    });

    // Forward tool results
    sdkService.on('tool_result', async (data) => {
      await this.publishEvent(channel, {
        type: 'tool_result',
        data,
      });
    });

    // Forward web search results
    sdkService.on('web_search_result', async (data) => {
      await this.publishEvent(channel, {
        type: 'web_search_result',
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

    // Forward system events
    sdkService.on('system', async (data) => {
      await this.publishEvent(channel, {
        type: 'system',
        data,
      });
    });

    // Forward final result
    sdkService.on('result', async (data) => {
      await this.publishEvent(channel, {
        type: 'result',
        data,
      });
    });

    // Log raw messages for debugging
    sdkService.on('message', (message) => {
      logger.debug({ message }, 'Raw message from Claude Code SDK');
    });
  }

  /**
   * Updates prompt status to processing (placeholder - prompts now in Claude directory)
   */
  private async markPromptAsProcessing(promptId: string): Promise<void> {
    // Note: Prompts are now stored in Claude directory, not database
    // Status tracking is handled via job status
    logger.info({ promptId }, 'Marking prompt as processing');
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
   * Note: Actual response content is stored by Claude Code SDK in ~/.claude directory
   */
  private async savePromptResult(
    promptId: string,
    result: {
      success: true;
      response: string;
      duration: number;
      toolCallCount: number;
      messages: any[];
      stopReason?: any;
      totalTokens?: number;
    },
  ): Promise<void> {
    // Extract tool calls from messages
    const toolCalls: any[] = [];
    let thinking: string | undefined;
    const citations: any[] = [];

    for (const msg of result.messages) {
      if (msg.type === 'tool_use') {
        toolCalls.push({
          tool: msg.name || msg.tool,
          params: msg.input || msg.params,
        });
      } else if (msg.type === 'thinking') {
        if (msg.data?.thinking) {
          thinking = msg.data.thinking;
        }
      } else if (msg.type === 'citations_delta') {
        if (msg.data?.citation) {
          citations.push(msg.data.citation);
        }
      }
    }

    // Save job completion metadata only - actual content stored in Claude directory
    await promptService.updatePromptResult(promptId, {
      status: 'completed' as const,
      metadata: {
        toolCalls,
        duration: result.duration,
        toolCallCount: result.toolCallCount,
        tokenCount: result.totalTokens,
        stopReason: result.stopReason,
        thinking,
        citations: citations.length > 0 ? citations : undefined,
        // Reference to Claude directory - actual content stored there
        hasClaudeDirectoryContent: true,
        responseSummary:
          result.response.length > 200
            ? `${result.response.substring(0, 200)}...`
            : result.response,
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
  private async handlePromptError(
    promptId: string,
    sessionId: string,
    channel: string,
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

    await promptService.updatePromptResult(promptId, {
      error: error.message,
      status: 'failed' as const,
      metadata: {
        errorDetails: {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        },
      },
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
      // Safely serialize the event with circular reference handling
      const serializedEvent = this.safeJsonStringify(event);
      if (serializedEvent) {
        await this.redis.publish(channel, serializedEvent);
      } else {
        logger.warn(
          { channel, eventType: event?.type },
          'Failed to serialize event - skipping publish',
        );
      }
    } catch (error) {
      // Log error but don't throw - stream may have already disconnected
      logger.warn(
        { channel, error, eventType: event?.type },
        'Failed to publish event (client may have disconnected)',
      );
    }
  }

  /**
   * Safely stringify JSON with circular reference handling and size limits
   */
  private safeJsonStringify(obj: any, maxSize: number = 100000): string | null {
    try {
      // Handle circular references
      const seen = new WeakSet();
      const result = JSON.stringify(obj, (_key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular]';
          }
          seen.add(value);
        }

        // Truncate very long strings to prevent message size issues
        if (typeof value === 'string' && value.length > 10000) {
          return `${value.substring(0, 10000)}...[truncated]`;
        }

        return value;
      });

      // Check message size and truncate if necessary
      if (result.length > maxSize) {
        logger.warn(`Event too large (${result.length} chars), truncating...`);
        const truncated = {
          ...obj,
          data:
            typeof obj.data === 'string'
              ? `${obj.data.substring(0, maxSize / 2)}...[truncated]`
              : '[Data too large - truncated]',
        };
        return JSON.stringify(truncated);
      }

      return result;
    } catch (error) {
      logger.error(`Failed to stringify event: ${error}`);
      // Return a safe fallback event
      return JSON.stringify({
        type: obj?.type || 'error',
        data: {
          type: 'error',
          error: 'Failed to serialize message',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Backfill the Claude Code session ID in the database
   */
  private async backfillClaudeSessionId(
    databaseSessionId: string,
    claudeCodeSessionId: string,
  ): Promise<void> {
    logger.info(
      {
        databaseSessionId,
        claudeCodeSessionId,
      },
      'Backfilling Claude Code session ID in database',
    );

    await db
      .update(sessions)
      .set({
        claudeCodeSessionId,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, databaseSessionId));

    logger.info(
      {
        databaseSessionId,
        claudeCodeSessionId,
      },
      'Successfully backfilled Claude Code session ID',
    );
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
