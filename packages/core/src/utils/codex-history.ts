import { z } from 'zod';
import path from 'node:path';
import { access } from 'node:fs/promises';
import { getHomeDirectory, joinPath } from './file';
import { createChildLogger } from './logger';

const logger = createChildLogger('codex-history');

const SessionMetaSchema = z.object({
  payload: z.object({ id: z.string() }),
});

export function getCodexSessionsRoot(): string {
  return joinPath(getHomeDirectory(), '.codex', 'sessions');
}

function extractSessionIdFromFilename(filePath: string): string | null {
  const base = path.basename(filePath);
  const match = base.match(/rollout-[^]+-([0-9a-fA-F-]{36})\.jsonl$/);
  return match ? match[1] ?? null : null;
}

async function listSessionFiles(rootDir: string): Promise<string[]> {
  try {
    await access(rootDir);
  } catch {
    return [];
  }

  const glob = new Bun.Glob('**/*.jsonl');
  const files = Array.from(glob.scanSync({ cwd: rootDir }));
  files.sort();
  return files.map((relativePath) => joinPath(rootDir, relativePath));
}

async function findSessionIdByMarker(params: {
  marker: string;
  rootDir: string;
  maxFiles?: number;
}): Promise<string | null> {
  const { marker, rootDir, maxFiles = 200 } = params;
  const files = await listSessionFiles(rootDir);
  if (files.length === 0) return null;

  const sliceStart = Math.max(files.length - maxFiles, 0);
  for (let i = files.length - 1; i >= sliceStart; i--) {
    const filePath = files[i];
    try {
      const content = await Bun.file(filePath).text();
      if (!content.includes(marker)) continue;
      const sessionId = extractSessionIdFromFilename(filePath);
      if (sessionId) return sessionId;

      // Fallback: attempt to parse first line for session id
      const firstLine = content.split(/\r?\n/).find((line) => line.length > 0);
      if (firstLine) {
        try {
          const parsed = JSON.parse(firstLine) as unknown;
          const schemaResult = SessionMetaSchema.safeParse(parsed);
          if (schemaResult.success) return schemaResult.data.payload.id;
        } catch {
          // ignore parse errors, continue scanning
        }
      }
    } catch (error) {
      logger.warn(
        { filePath, error: error instanceof Error ? error.message : String(error) },
        'Failed to read Codex session file',
      );
    }
  }

  return null;
}

export async function waitForSessionIdForPrompt(
  marker: string,
  options: {
    timeoutMs?: number;
    pollIntervalMs?: number;
    sessionsDir?: string;
  } = {},
): Promise<string | null> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const pollIntervalMs = options.pollIntervalMs ?? 400;
  const sessionsDir = options.sessionsDir ?? getCodexSessionsRoot();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const sessionId = await findSessionIdByMarker({
      marker,
      rootDir: sessionsDir,
    });
    if (sessionId) {
      logger.info({ marker, sessionId }, 'Found Codex session id');
      return sessionId;
    }

    await Bun.sleep(pollIntervalMs);
  }

  logger.warn({ marker, timeoutMs }, 'Timeout waiting for Codex session id');
  return null;
}
