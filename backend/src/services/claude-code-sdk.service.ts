import { type Options, type Query, query, type SDKMessage } from '@anthropic-ai/claude-code';
import { directoryExists } from '@/utils/file';
import { createChildLogger } from '@/utils/logger';
import type { MessageService } from './message.service';

const logger = createChildLogger('claude-code-sdk');

export interface ClaudeCodeOptions {
  sessionId: string;
  projectPath: string;
  messageService: MessageService;
}

export type ClaudeCodeResult =
  | {
      success: true;
      duration: number;
    }
  | {
      success: false;
      error: string;
      duration: number;
    };

/**
 * Simplified Claude Code SDK Service
 * Saves messages directly to database as they arrive
 */
export class ClaudeCodeSDKService {
  private startTime: number = 0;
  private sessionId: string;
  private isProcessing = false;
  private currentQuery: Query | null = null;
  private pathToClaudeCodeExecutable: string;
  private messageService: MessageService;

  constructor(private options: ClaudeCodeOptions) {
    this.sessionId = options.sessionId;
    this.messageService = options.messageService;

    if (!process.env.CLAUDE_CODE_PATH) {
      throw new Error('CLAUDE_CODE_PATH is required');
    }
    this.pathToClaudeCodeExecutable = process.env.CLAUDE_CODE_PATH;
  }

  /**
   * Execute a prompt using Claude Code SDK
   * Saves messages directly to database as they arrive
   * Supports session resumption by finding the last Claude session ID
   */
  async execute(prompt: string): Promise<ClaudeCodeResult> {
    if (this.isProcessing) {
      throw new Error('Already processing a prompt');
    }

    this.isProcessing = true;
    this.startTime = Date.now();

    try {
      // Check for existing Claude session ID for resumption
      const lastClaudeSessionId = await this.messageService.getLastClaudeCodeSessionId(
        this.sessionId,
      );

      // Validate project path exists using File Utils
      const pathExists = await directoryExists(this.options.projectPath);
      if (!pathExists) {
        const errorMessage = `Project path does not exist: ${this.options.projectPath}`;
        logger.error(
          { sessionId: this.sessionId, projectPath: this.options.projectPath },
          errorMessage,
        );
        return {
          success: false,
          error: errorMessage,
          duration: Date.now() - this.startTime,
        };
      }

      // Configure SDK options with resumption support
      // Use node explicitly and point to the actual JS file
      const sdkOptions: Options = {
        cwd: this.options.projectPath,
        permissionMode: 'bypassPermissions',
        pathToClaudeCodeExecutable: this.pathToClaudeCodeExecutable,
        executable: 'node',
        ...(lastClaudeSessionId && { resume: lastClaudeSessionId }),
        // Add stderr debugging
        stderr: (data: string) => {
          logger.error({ sessionId: this.sessionId, stderr: data }, 'Claude Code SDK stderr');
        },
      };

      logger.info(
        {
          sessionId: this.sessionId,
          prompt: prompt.substring(0, 100),
          sdkOptions,
        },
        'Starting Claude Code SDK query',
      );

      this.currentQuery = query({ prompt, options: sdkOptions });

      // Process messages as they stream and save directly to database
      for await (const message of this.currentQuery) {
        await this.handleSDKMessage(message);
      }

      // Query completed successfully
      const duration = Date.now() - this.startTime;

      logger.info(
        {
          sessionId: this.sessionId,
          duration,
        },
        'Claude Code SDK query completed successfully',
      );

      return {
        success: true,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - this.startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(
        {
          sessionId: this.sessionId,
          error: errorMessage,
        },
        'Claude Code SDK query failed',
      );

      return {
        success: false,
        error: errorMessage,
        duration,
      };
    } finally {
      this.isProcessing = false;
      this.currentQuery = null;
    }
  }

  /**
   * Handle a message from the SDK and save directly to database
   */
  private async handleSDKMessage(message: SDKMessage): Promise<void> {
    // Save message directly to database as JSON string, including Claude session ID
    try {
      await this.messageService.saveSDKMessage(
        this.sessionId,
        message,
        message.session_id, // Extract Claude SDK session ID
      );
    } catch (error) {
      logger.error(
        {
          sessionId: this.sessionId,
          messageType: message.type,
          claudeSessionId: message.session_id,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to save SDK message to database',
      );
    }
  }

  /**
   * Abort the current execution
   */
  async abort(): Promise<void> {
    if (this.currentQuery && this.isProcessing) {
      logger.info({ sessionId: this.sessionId }, 'Aborting Claude Code SDK query');
      try {
        if (this.currentQuery.interrupt) {
          await this.currentQuery.interrupt();
        }
      } catch (error) {
        logger.error(
          {
            sessionId: this.sessionId,
            error: error instanceof Error ? error.message : String(error),
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
