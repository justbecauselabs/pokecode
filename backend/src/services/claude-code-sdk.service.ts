import { constants as fsConstants, promises as fsPromises } from 'node:fs';
import { type Options, type Query, query, type SDKMessage } from '@anthropic-ai/claude-code';
import { createChildLogger } from '@/utils/logger';
import type { MessageService } from './message.service';

const logger = createChildLogger('claude-code-sdk');

export interface ClaudeCodeOptions {
  sessionId: string;
  projectPath: string;
  claudeCodeSessionId?: string | null;
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
   */
  async execute(prompt: string): Promise<ClaudeCodeResult> {
    if (this.isProcessing) {
      throw new Error('Already processing a prompt');
    }

    this.isProcessing = true;
    this.startTime = Date.now();

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
          { sessionId: this.sessionId, projectPath: this.options.projectPath },
          errorMessage,
        );
        return {
          success: false,
          error: errorMessage,
          duration: Date.now() - this.startTime,
        };
      }

      // Configure SDK options
      const sdkOptions: Options = {
        cwd: this.options.projectPath,
        ...(shouldResume && { resume: claudeCodeSessionId }),
        permissionMode: 'bypassPermissions',
        pathToClaudeCodeExecutable: this.pathToClaudeCodeExecutable,
        executable: 'node',
      };

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
    // Save message directly to database as JSON string
    try {
      await this.messageService.saveSDKMessage(this.sessionId, message);
    } catch (error) {
      logger.error(
        {
          sessionId: this.sessionId,
          messageType: message.type,
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
