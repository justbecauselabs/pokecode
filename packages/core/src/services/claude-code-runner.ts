import type { SDKMessage } from '@anthropic-ai/claude-code';
import { type Options, type Query, query } from '@anthropic-ai/claude-code';
import { getConfig } from '../config';
import { directoryExists } from '../utils/file';
import { createChildLogger } from '../utils/logger';
import type { AgentRunner, RunnerExecuteParams, RunnerResult } from './agent-runner';
import type { MessageService } from './message.service';

const logger = createChildLogger('claude-code-runner');

export class ClaudeCodeRunner implements AgentRunner {
  private startTime = 0;
  private sessionId: string;
  private isProcessing = false;
  private currentQuery: Query | null = null;
  private abortController: AbortController | null = null;
  private pathToClaudeCodeExecutable = '';

  constructor(
    private options: {
      sessionId: string;
      projectPath: string;
      messageService: MessageService;
      model?: string | undefined;
    },
  ) {
    this.sessionId = options.sessionId;
  }

  private async initialize() {
    if (this.pathToClaudeCodeExecutable) return;
    const config = await getConfig();
    if (!config.claudeCodePath) throw new Error('claudeCodePath is required');
    this.pathToClaudeCodeExecutable = config.claudeCodePath;
  }

  async execute(params: RunnerExecuteParams): Promise<RunnerResult> {
    if (this.isProcessing) throw new Error('Already processing a prompt');
    await this.initialize();

    this.isProcessing = true;
    this.startTime = Date.now();
    this.abortController = new AbortController();

    try {
      const lastProviderSessionId = await this.options.messageService.getLastProviderSessionId(
        this.sessionId,
      );
      const pathExists = await directoryExists(this.options.projectPath);
      if (!pathExists) {
        const errorMessage = `Project path does not exist: ${this.options.projectPath}`;
        logger.error(
          { sessionId: this.sessionId, projectPath: this.options.projectPath },
          errorMessage,
        );
        return { success: false, error: errorMessage, durationMs: Date.now() - this.startTime };
      }

      const sdkOptions: Options = {
        cwd: this.options.projectPath,
        permissionMode: 'bypassPermissions',
        pathToClaudeCodeExecutable: this.pathToClaudeCodeExecutable,
        executable: 'node',
        abortController: this.abortController,
        ...(lastProviderSessionId && { resume: lastProviderSessionId }),
        ...(this.options.model && { model: this.options.model }),
        stderr: (data: string) => {
          logger.error({ sessionId: this.sessionId, stderr: data }, 'Claude Code stderr');
        },
      };

      logger.info(
        { sessionId: this.sessionId, prompt: params.prompt.substring(0, 100), sdkOptions },
        'Starting Claude Code query',
      );

      this.currentQuery = query({ prompt: params.prompt, options: sdkOptions });
      for await (const message of this.currentQuery) {
        await this.handleSDKMessage(message);
      }

      const duration = Date.now() - this.startTime;
      logger.info(
        { sessionId: this.sessionId, duration },
        'Claude Code query completed successfully',
      );
      return { success: true, durationMs: duration };
    } catch (error) {
      const duration = Date.now() - this.startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ sessionId: this.sessionId, error: errorMessage }, 'Claude Code query failed');
      return { success: false, error: errorMessage, durationMs: duration };
    } finally {
      this.isProcessing = false;
      this.currentQuery = null;
      this.abortController = null;
    }
  }

  private async handleSDKMessage(message: SDKMessage): Promise<void> {
    try {
      const transformed =
        message.type === 'result' ? { ...message, permission_denials: [] } : message;
      await this.options.messageService.saveSDKMessage({
        sessionId: this.sessionId,
        sdkMessage: transformed,
        providerSessionId: message.session_id,
      });
    } catch (error) {
      logger.error(
        {
          sessionId: this.sessionId,
          messageType: message.type,
          providerSessionId: message.session_id,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to save SDK message to database',
      );
    }
  }

  async abort(): Promise<void> {
    if (this.abortController && this.isProcessing) {
      logger.info({ sessionId: this.sessionId }, 'Claude runner abort requested');
      this.abortController.abort();
      this.isProcessing = false;
      logger.info({ sessionId: this.sessionId }, 'Claude runner aborted');
    }
  }
}
