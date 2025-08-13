import { EventEmitter } from 'node:events';
import { constants as fsConstants, promises as fsPromises } from 'node:fs';
import { type Options, Query, query, type SDKMessage } from '@anthropic-ai/claude-code';
import type { Citation, ClaudeCodeMessage, MessageContent } from '@/types';
// These imports are for future use when we integrate with message service
import { createChildLogger } from '@/utils/logger';

const logger = createChildLogger('claude-code-sdk');

// Re-export from types for backward compatibility
export type { ClaudeCodeMessage } from '@/types';

export interface ClaudeCodeOptions {
  sessionId: string;
  projectPath: string;
  claudeCodeSessionId?: string | null;
}

// Enhanced streaming state
interface StreamingState {
  activeBlocks: Map<
    number,
    {
      type: string;
      content: string;
      citations?: Citation[];
      thinking?: string;
      signature?: string;
    }
  >;
  messageId?: string;
  totalTokens: number;
  stopReason?: string;
}

export type ClaudeCodeResult =
  | {
      success: true;
      response: string;
      duration: number;
      toolCallCount: number;
      messages: ClaudeCodeMessage[];
      stopReason?: string;
      totalTokens?: number;
    }
  | {
      success: false;
      error: string;
      duration: number;
      messages: ClaudeCodeMessage[];
      stopReason?: string;
      totalTokens?: number;
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
  private currentQuery: Query | null = null;
  private pathToClaudeCodeExecutable: string;
  private streamingState: StreamingState = {
    activeBlocks: new Map(),
    totalTokens: 0,
  };
  private capturedClaudeSessionId: string | null = null;

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
    this.streamingState = {
      activeBlocks: new Map(),
      totalTokens: 0,
    };

    try {
      const claudeCodeSessionId = this.options.claudeCodeSessionId ?? null;
      const shouldResume = claudeCodeSessionId !== null && claudeCodeSessionId !== undefined;
      logger.info(
        {
          sessionId: this.sessionId,
          prompt: prompt.substring(0, 100),
          cwd: this.options.projectPath,
          resuming: shouldResume,
        },
        'Starting Claude Code SDK query',
      );

      // Validate project path exists
      try {
        await fsPromises.access(this.options.projectPath, fsConstants.F_OK);
      } catch (_error) {
        const errorMessage = `Project path does not exist: ${this.options.projectPath}`;
        logger.error(
          {
            sessionId: this.sessionId,
            projectPath: this.options.projectPath,
          },
          errorMessage,
        );

        return {
          success: false,
          error: errorMessage,
          duration: Date.now() - this.startTime,
          messages: this.messages,
        };
      }

      // Configure SDK options to use local Claude Max authentication
      const sdkOptions: Options = {
        cwd: this.options.projectPath,
        // Only resume if we have a real Claude Code session ID
        ...(shouldResume && { resume: claudeCodeSessionId }),
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
              shouldResume,
            },
            'Claude Code SDK stderr',
          );
        },
      };

      logger.info(
        {
          databaseSessionId: this.sessionId,
          claudeCodeSessionId,
          shouldResume,
          projectPath: this.options.projectPath,
        },
        'Claude Code SDK configuration',
      );

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
            error: {
              message: errorMessage,
              stack: error instanceof Error ? error.stack : undefined,
              name: error instanceof Error ? error.name : undefined,
              code:
                error && typeof error === 'object' && 'code' in error
                  ? (error as { code: unknown }).code
                  : undefined,
            },
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
        ...(this.streamingState.stopReason !== undefined && {
          stopReason: this.streamingState.stopReason,
        }),
        ...(this.streamingState.totalTokens !== undefined && {
          totalTokens: this.streamingState.totalTokens,
        }),
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
    const convertedMessage: ClaudeCodeMessage = message as ClaudeCodeMessage;
    this.messages.push(convertedMessage);

    // Debug: Log first few messages to see the structure
    if (this.messages.length <= 3) {
      logger.info(
        {
          messageNumber: this.messages.length,
          messageType: message.type,
          messageKeys: Object.keys(message),
          hasSessionId: !!(message && typeof message === 'object' && 'session_id' in message),
          message: JSON.stringify(message).substring(0, 500),
        },
        'Debug: SDK message structure',
      );
    }

    // Capture Claude Code session ID from first message that has it
    if (
      !this.capturedClaudeSessionId &&
      message &&
      typeof message === 'object' &&
      'session_id' in message &&
      typeof message.session_id === 'string'
    ) {
      this.capturedClaudeSessionId = message.session_id;
      logger.info(
        {
          databaseSessionId: this.sessionId,
          claudeCodeSessionId: this.capturedClaudeSessionId,
        },
        'Captured Claude Code session ID',
      );

      // Emit the captured session ID for the worker to handle
      this.emit('claude_session_captured', {
        databaseSessionId: this.sessionId,
        claudeCodeSessionId: this.capturedClaudeSessionId,
      });
    }

    // Emit the raw message for streaming
    this.emit('message', convertedMessage);

    // Process specific message types
    switch (message.type) {
      case 'assistant':
        // Assistant response message
        if (message.message.content) {
          const textContent = message.message.content
            .filter(
              (c: unknown): c is MessageContent =>
                !!(
                  c &&
                  typeof c === 'object' &&
                  'type' in c &&
                  (c as { type: string }).type === 'text'
                ),
            )
            .map((c: MessageContent) => {
              if (c.type === 'text') {
                return (c as { type: 'text'; text: string }).text;
              }
              return '';
            })
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
          const toolUses = message.message.content.filter(
            (c: unknown): c is MessageContent =>
              !!(
                c &&
                typeof c === 'object' &&
                'type' in c &&
                (c as { type: string }).type === 'tool_use'
              ),
          );
          this.toolCallCount += toolUses.length;

          // Emit tool use events
          for (const toolUse of toolUses) {
            if (toolUse.type === 'tool_use') {
              const toolUseContent = toolUse as {
                type: 'tool_use';
                name: string;
                input: Record<string, unknown>;
              };
              this.emit('tool_use', {
                type: 'tool_use',
                tool: toolUseContent.name,
                params: toolUseContent.input,
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
        break;

      case 'user':
        // User message (tool results)
        if (message.message.content) {
          const toolResults = message.message.content.filter(
            (c: unknown): c is MessageContent =>
              !!(
                c &&
                typeof c === 'object' &&
                'type' in c &&
                (c as { type: string }).type === 'tool_result'
              ),
          );
          for (const result of toolResults) {
            if (result.type === 'tool_result') {
              const toolResultContent = result as {
                type: 'tool_result';
                tool_use_id: string;
                content?: string;
              };
              this.emit('tool_result', {
                type: 'tool_result',
                tool: toolResultContent.tool_use_id,
                result: this.truncateResult(toolResultContent.content || ''),
                timestamp: new Date().toISOString(),
              });
            }
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
            error: {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            },
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
