import { createId } from '@paralleldrive/cuid2';
import { type CodexSDKMessage, CodexSDKMessageSchema } from '@pokecode/types';
import type { Subprocess } from 'bun';
import { getConfig } from '../config';
import { waitForSessionIdForPrompt } from '../utils/codex-history';
import { createChildLogger } from '../utils/logger';
import type { AgentRunner, RunnerExecuteParams, RunnerStreamItem } from './agent-runner';
import type { MessageService } from './message.service';

const logger = createChildLogger('codex-runner');

async function* readLines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        if (buffer.length > 0) {
          yield buffer;
          buffer = '';
        }
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      // handle both \n and \r\n
      let idx = buffer.indexOf('\n');
      while (idx !== -1) {
        const line = buffer.slice(0, idx).replace(/\r$/, '');
        if (line.length > 0) yield line;
        buffer = buffer.slice(idx + 1);
        idx = buffer.indexOf('\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export class CodexRunner implements AgentRunner {
  private proc: Subprocess | null = null;
  private isProcessing = false;

  constructor(
    private options: {
      sessionId: string;
      projectPath: string;
      model?: string | undefined;
      messageService: MessageService;
    },
  ) {}

  private async initialize(): Promise<string> {
    const config = await getConfig();
    const path = config.codexCliPath;
    if (!path) throw new Error('codexCliPath is required');
    return path;
  }

  async *execute(params: RunnerExecuteParams): AsyncIterable<RunnerStreamItem> {
    if (this.isProcessing) throw new Error('Already processing a prompt');
    const codexCliPath = await this.initialize();
    this.isProcessing = true;

    // Attempt resume if we have a prior provider session id
    const lastProviderSessionId = await this.options.messageService.getLastProviderSessionId(
      this.options.sessionId,
    );

    // When we don't have a provider session id yet, append a unique marker to the prompt.
    // codex-cli writes the full prompt line into ~/.codex/history.jsonl, so this marker lets us
    // unambiguously match the history entry and recover the generated session id for resume.
    const markerId = !lastProviderSessionId ? createId() : null;
    const markerText = markerId ? `Ignore this id: ${markerId}` : null;
    const promptWithMarker = markerText ? `${params.prompt}\n\n${markerText}` : params.prompt;

    const args = [
      '-m',
      'gpt-5-codex',
      '-c',
      '"model_reasoning_effort=high"',
      '--search',
      'exec',
      '--json',
      '--dangerously-bypass-approvals-and-sandbox',
      ...(lastProviderSessionId ? (['resume', lastProviderSessionId] as const) : ([] as const)),
      promptWithMarker,
    ];

    logger.info(
      {
        sessionId: this.options.sessionId,
        args,
        codexCliPath,
        projectPath: this.options.projectPath,
        resume: !!lastProviderSessionId,
        resumeSessionId: lastProviderSessionId ?? null,
        marker: markerId,
      },
      'Running Codex CLI',
    );

    const proc = Bun.spawn({
      cmd: [codexCliPath, ...args],
      cwd: this.options.projectPath,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    this.proc = proc;

    // Abort handling
    const onAbort = () => {
      if (this.proc) {
        try {
          // Graceful first
          this.proc.kill();
        } catch {
          // Ignore
        }
      }
    };
    params.abortController.signal.addEventListener('abort', onAbort, { once: true });

    logger.info({ sessionId: this.options.sessionId }, 'Codex runner initialized');

    let stderrError: Error | null = null;
    const stderrMonitor = (async () => {
      try {
        if (!proc.stderr) return;
        const reader = proc.stderr.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              const text = decoder.decode(value).trim();
              if (text.length > 0) {
                logger.error(
                  { sessionId: this.options.sessionId, stderr: text },
                  'Codex CLI wrote to stderr',
                );
                stderrError = new Error(`Codex CLI emitted stderr output: ${text}`);
                try {
                  proc.kill();
                } catch {
                  /* ignore */
                }
                break;
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (error) {
        logger.error(
          {
            sessionId: this.options.sessionId,
            error: error instanceof Error ? error.message : String(error),
          },
          'Codex stderr monitor failed',
        );
      }
    })();

    try {
      if (!proc.stdout) {
        logger.error({ sessionId: this.options.sessionId }, 'No codex stdout');
        return; // nothing to stream
      }
      let count = 0;
      let providerSessionId: string | null = null;

      for await (const line of readLines(proc.stdout)) {
        try {
          if (stderrError) throw stderrError;

          const parsed = JSON.parse(line) as unknown;
          const ok = CodexSDKMessageSchema.safeParse(parsed);
          if (!ok.success) {
            logger.debug({ issues: ok.error.issues }, 'Ignoring non-SDK Codex line');
            continue;
          }
          const message: CodexSDKMessage = ok.data;
          count++;

          // If we don't have a provider session id yet, block and get it now
          if (providerSessionId === null && markerText) {
            const id = await waitForSessionIdForPrompt(markerText, {
              timeoutMs: 5_000,
              pollIntervalMs: 300,
            });
            if (!id) {
              const err = 'Timed out waiting for Codex session id';
              logger.error({ sessionId: this.options.sessionId }, err);
              this.abort();
              throw new Error(err);
            }
            providerSessionId = id;
          }

          // Stream message with the captured providerSessionId
          yield { provider: 'codex-cli', providerSessionId, message };
        } catch (e) {
          if (stderrError) throw stderrError;
          logger.warn(
            { error: e instanceof Error ? e.message : String(e) },
            'Codex JSONL parse failure',
          );
        }
      }
      if (stderrError) throw stderrError;
      logger.info({ sessionId: this.options.sessionId, count }, 'Codex stream complete');
    } finally {
      params.abortController.signal.removeEventListener('abort', onAbort);
      this.isProcessing = false;
      this.proc = null;
      try {
        await stderrMonitor;
      } catch {
        /* ignore */
      }
    }
  }

  async abort(): Promise<void> {
    if (this.proc && this.isProcessing) {
      try {
        this.proc.kill();
      } catch {
        logger.error({ sessionId: this.options.sessionId }, 'Codex CLI kill failed');
      }
      this.isProcessing = false;
    }
  }
}
