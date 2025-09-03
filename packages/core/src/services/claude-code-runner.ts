import type { SDKMessage } from '@anthropic-ai/claude-code';
import { type Options, type Query, query } from '@anthropic-ai/claude-code';
import { getConfig } from '../config';
import { directoryExists } from '../utils/file';
import { createChildLogger } from '../utils/logger';
import type { AgentRunner, RunnerExecuteParams, RunnerStreamItem } from './agent-runner';
import type { MessageService } from './message.service';

const logger = createChildLogger('claude-code-runner');

export class ClaudeCodeRunner implements AgentRunner {
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

  async *execute(params: RunnerExecuteParams): AsyncIterable<RunnerStreamItem> {
    if (this.isProcessing) throw new Error('Already processing a prompt');
    await this.initialize();

    this.isProcessing = true;
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
        return; // end stream early
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
        const transformed: SDKMessage =
          message.type === 'result' ? { ...message, permission_denials: [] } : message;
        yield {
          provider: 'claude-code',
          providerSessionId: message.session_id,
          message: transformed,
        } as const;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ sessionId: this.sessionId, error: errorMessage }, 'Claude Code query failed');
      return; // end stream with error; worker handles catch
    } finally {
      this.isProcessing = false;
      this.currentQuery = null;
      this.abortController = null;
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
