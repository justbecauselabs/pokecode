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
      '--yolo',
      '-c',
      '"model_reasoning_effort=high"',
      '--search',
      '-m',
      'gpt-5',
      'exec',
      ...(lastProviderSessionId ? (['resume', lastProviderSessionId] as const) : ([] as const)),
      '--json',
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

    // Record spawn time in seconds to filter history.jsonl
    const spawnedAtSec = Math.floor(Date.now() / 1000);

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

    // Log stderr in background
    (async () => {
      try {
        if (proc.stderr) {
          const reader = proc.stderr.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            logger.debug(
              { sessionId: this.options.sessionId, stderr: decoder.decode(value) },
              'codex stderr',
            );
          }
        }
      } catch {
        logger.error({ sessionId: this.options.sessionId }, 'Codex stderr error');
        /* ignore */
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
          logger.warn(
            { error: e instanceof Error ? e.message : String(e) },
            'Codex JSONL parse failure',
          );
        }
      }
      logger.info({ sessionId: this.options.sessionId, count }, 'Codex stream complete');
    } finally {
      params.abortController.signal.removeEventListener('abort', onAbort);
      this.isProcessing = false;
      this.proc = null;
    }
  }

  async abort(): Promise<void> {
    if (this.proc && this.isProcessing) {
      try {
        this.proc.kill();
      } catch {
        /* ignore */
      }
      this.isProcessing = false;
    }
  }
}
