import { EventEmitter } from 'node:events';
import { type Options, query, type SDKMessage } from '@anthropic-ai/claude-code';
import { createChildLogger } from '@/utils/logger';

const logger = createChildLogger('claude-code-sdk');

export interface ClaudeCodeMessage {
  type: string;
  [key: string]: any;
}

export interface ClaudeCodeOptions {
  sessionId: string;
  projectPath: string;
}

export type ClaudeCodeResult =
  | {
      success: true;
      response: string;
      duration: number;
      toolCallCount: number;
      messages: ClaudeCodeMessage[];
    }
  | {
      success: false;
      error: string;
      duration: number;
      messages: ClaudeCodeMessage[];
    };

/**
 * Service for interacting with Claude Code SDK
 * Uses the SDK directly instead of spawning CLI process
 */
export class ClaudeCodeSDKService extends EventEmitter {
  private messages: ClaudeCodeMessage[] = [];
  private assistantMessages: string[] = [];
  private toolCallCount = 0;
  private startTime: number = 0;
  private sessionId: string;
  private isProcessing = false;
  private currentQuery: any = null;
  private pathToClaudeCodeExecutable: string;

  constructor(private options: ClaudeCodeOptions) {
    super();
    this.sessionId = options.sessionId;

    if (!process.env.CLAUDE_CODE_PATH) {
      throw new Error('CLAUDE_CODE_PATH is required');
    }
    this.pathToClaudeCodeExecutable = process.env.CLAUDE_CODE_PATH;
  }

  /**
   * Execute a prompt using Claude Code SDK
   */
  async execute(prompt: string): Promise<ClaudeCodeResult> {
    if (this.isProcessing) {
      throw new Error('Already processing a prompt');
    }

    this.isProcessing = true;
    this.startTime = Date.now();
    this.messages = [];
    this.assistantMessages = [];
    this.toolCallCount = 0;

    try {
      logger.info(
        {
          sessionId: this.sessionId,
          prompt: prompt.substring(0, 100),
          cwd: this.options.projectPath,
        },
        'Starting Claude Code SDK query',
      );

      // Configure SDK options to use local Claude Max authentication
      const sdkOptions: Options = {
        cwd: this.options.projectPath,
        // Don't resume for now - start fresh sessions
        // resume: this.sessionId,
        permissionMode: 'bypassPermissions',
        // Use local Claude installation to access Claude Max account
        pathToClaudeCodeExecutable: this.pathToClaudeCodeExecutable,
        executable: 'node',
        // Capture stderr for debugging
        stderr: (data: string) => {
          logger.debug(
            {
              sessionId: this.sessionId,
              stderr: data,
            },
            'Claude Code SDK stderr',
          );
        },
      };

      try {
        this.currentQuery = query({ prompt, options: sdkOptions });

        // Process messages as they stream
        for await (const message of this.currentQuery) {
          this.handleSDKMessage(message);
        }
      } catch (error) {
        const duration = Date.now() - this.startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error(
          {
            sessionId: this.sessionId,
            error,
          },
          'Claude Code SDK query failed',
        );

        // Emit error event for streaming
        this.emit('error', {
          type: 'error',
          error: errorMessage,
          timestamp: new Date().toISOString(),
        });

        return {
          success: false,
          error: errorMessage,
          duration,
          messages: this.messages,
        };
      }

      // Query completed successfully
      const duration = Date.now() - this.startTime;
      const result: ClaudeCodeResult = {
        success: true,
        response: this.assistantMessages.join('\n\n'),
        duration,
        toolCallCount: this.toolCallCount,
        messages: this.messages,
      };

      logger.info(
        {
          sessionId: this.sessionId,
          duration,
          toolCallCount: this.toolCallCount,
          messageCount: this.messages.length,
        },
        'Claude Code SDK query completed successfully',
      );

      return result;
    } finally {
      this.isProcessing = false;
      this.currentQuery = null;
    }
  }

  /**
   * Handle a message from the SDK
   */
  private handleSDKMessage(message: SDKMessage): void {
    // Convert SDK message to our format and store it
    const convertedMessage: ClaudeCodeMessage = message as any;
    this.messages.push(convertedMessage);

    // Emit the raw message for streaming
    this.emit('message', convertedMessage);

    // Process specific message types
    switch (message.type) {
      case 'assistant':
        // Assistant response message
        if (message.message.content) {
          const textContent = message.message.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('\n');

          if (textContent) {
            this.assistantMessages.push(textContent);
            this.emit('assistant', {
              type: 'message',
              content: textContent,
              timestamp: new Date().toISOString(),
            });
          }

          // Count tool uses
          const toolUses = message.message.content.filter((c: any) => c.type === 'tool_use');
          this.toolCallCount += toolUses.length;

          // Emit tool use events
          for (const toolUse of toolUses) {
            this.emit('tool_use', {
              type: 'tool_use',
              tool: toolUse.name,
              params: toolUse.input,
              timestamp: new Date().toISOString(),
            });
          }
        }
        break;

      case 'user':
        // User message (tool results)
        if (message.message.content) {
          const toolResults = message.message.content.filter((c: any) => c.type === 'tool_result');
          for (const result of toolResults) {
            this.emit('tool_result', {
              type: 'tool_result',
              tool: result.tool_use_id,
              result: this.truncateResult(result.content || ''),
              timestamp: new Date().toISOString(),
            });
          }
        }
        break;

      case 'result':
        // Final result message
        if (message.subtype === 'success') {
          this.emit('result', {
            type: 'result',
            success: true,
            result: message.result,
            usage: message.usage,
            cost: message.total_cost_usd,
            timestamp: new Date().toISOString(),
          });
        } else {
          this.emit('error', {
            type: 'error',
            error: `Query failed: ${message.subtype}`,
            timestamp: new Date().toISOString(),
          });
        }
        break;

      case 'system':
        // System initialization message
        logger.debug(
          {
            sessionId: this.sessionId,
            message,
          },
          'Claude Code SDK system message',
        );
        this.emit('system', {
          type: 'system',
          tools: message.tools,
          model: message.model,
          timestamp: new Date().toISOString(),
        });
        break;

      default:
        logger.debug(
          {
            sessionId: this.sessionId,
            message,
          },
          'Unknown SDK message type',
        );
    }
  }

  /**
   * Truncate long results for streaming
   */
  private truncateResult(result: string, maxLength: number = 1000): string {
    let processedResult = result;
    if (typeof processedResult !== 'string') {
      processedResult = JSON.stringify(processedResult);
    }
    if (processedResult.length <= maxLength) {
      return processedResult;
    }
    return `${processedResult.substring(0, maxLength)}...[truncated]`;
  }

  /**
   * Abort the current execution
   */
  async abort(): Promise<void> {
    if (this.currentQuery && this.isProcessing) {
      logger.info({ sessionId: this.sessionId }, 'Aborting Claude Code SDK query');
      try {
        // The SDK query has an interrupt method for streaming inputs
        if (this.currentQuery.interrupt) {
          await this.currentQuery.interrupt();
        }
      } catch (error) {
        logger.error(
          {
            sessionId: this.sessionId,
            error,
          },
          'Error aborting Claude Code SDK query',
        );
      }
      this.isProcessing = false;
    }
  }

  /**
   * Check if currently processing
   */
  isRunning(): boolean {
    return this.isProcessing;
  }
}
