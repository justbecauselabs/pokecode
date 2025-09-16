import { z } from 'zod';
import { getHomeDirectory, joinPath } from './file';
import { createChildLogger } from './logger';

const logger = createChildLogger('codex-history');

const HistoryEntrySchema = z.object({
  session_id: z.string(),
  ts: z.number().int(),
  text: z.string(),
});
type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export function getCodexHistoryPath(): string {
  return joinPath(getHomeDirectory(), '.codex', 'history.jsonl');
}

async function findSessionIdByMarker(params: {
  marker: string;
  sinceTs: number;
  filePath: string;
}): Promise<string | null> {
  const { marker, sinceTs, filePath } = params;
  const file = Bun.file(filePath);
  if (!(await file.exists())) return null;

  const content = await file.text();
  if (content.trim().length === 0) return null;

  const lines = content.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.length === 0) continue;
    if (!line.includes(marker)) continue;
    try {
      const parsed = HistoryEntrySchema.parse(JSON.parse(line) as unknown);
      if (parsed.ts < sinceTs) continue;
      return parsed.session_id;
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error), line },
        'Failed to parse Codex history line',
      );
    }
  }
  return null;
}

export async function waitForSessionIdForPrompt(
  marker: string,
  options: {
    sinceTs?: number;
    timeoutMs?: number;
    pollIntervalMs?: number;
    filePath?: string;
  } = {},
): Promise<string | null> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const pollIntervalMs = options.pollIntervalMs ?? 400;
  const deadline = Date.now() + timeoutMs;
  const filePath = options.filePath ?? getCodexHistoryPath();
  const sinceTs = options.sinceTs ?? 0;

  while (Date.now() < deadline) {
    try {
      const sessionId = await findSessionIdByMarker({ marker, sinceTs, filePath });
      if (sessionId) {
        logger.info({ marker, sessionId }, 'Found Codex session id');
        return sessionId;
      }
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Error reading Codex history file',
      );
    }
    await Bun.sleep(pollIntervalMs);
  }

  logger.warn({ timeoutMs, sinceTs, marker }, 'Timeout waiting for Codex session id');
  return null;
}
