import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Subprocess } from 'bun';
import { getConfig } from '../config';
import { createChildLogger } from '../utils/logger';
import type { AgentRunner, RunnerExecuteParams, RunnerStreamItem } from './agent-runner';

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

    const args = [
      '--yolo',
      '-c',
      '"model_reasoning_effort=high"',
      '--search',
      '-m',
      'gpt-5',
      'exec',
      '--json',
      params.prompt,
    ];

    logger.info(
      {
        sessionId: this.options.sessionId,
        args,
        codexCliPath,
        projectPath: this.options.projectPath,
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
      const capturePath = join(this.options.projectPath, 'codex-messages.jsonl');
      let count = 0;
      for await (const line of readLines(proc.stdout)) {
        try {
          const obj = JSON.parse(line);
          await appendFile(capturePath, `${JSON.stringify(obj)}\n`, 'utf8');
          logger.info({ obj }, `Codex message emitted to ${capturePath}`);
          count++;
        } catch (e) {
          logger.warn(
            { error: e instanceof Error ? e.message : String(e), line },
            'Codex emit parse/append failure',
          );
        }
      }
      logger.info(
        { sessionId: this.options.sessionId, count, capturePath },
        'Codex capture complete',
      );
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
