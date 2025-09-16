import { z } from 'zod';
import { getHomeDirectory, joinPath } from './file';
import { createChildLogger } from './logger';

const logger = createChildLogger('codex-history');

// JSONL entry shape for ~/.codex/history.jsonl
const HistoryEntrySchema = z.object({
  session_id: z.string(),
  ts: z.number().int(), // seconds since epoch
  text: z.string(),
});
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export function getCodexHistoryPath(): string {
  return joinPath(getHomeDirectory(), '.codex', 'history.jsonl');
}

function normalizeNewlines(s: string): string {
  return s.replace(/\r\n?/g, '\n');
}

function linesFromText(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  return trimmed.split(/\n/);
}

function parseHistoryLine(line: string): HistoryEntry | null {
  try {
    const parsed = HistoryEntrySchema.safeParse(JSON.parse(line) as unknown);
    if (!parsed.success) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export async function readHistoryTail(
  options: { filePath?: string; maxLines?: number } = {},
): Promise<HistoryEntry[]> {
  const filePath = options.filePath ?? getCodexHistoryPath();
  const maxLines = options.maxLines ?? 400;
  const file = Bun.file(filePath);
  const exists = await file.exists();
  if (!exists) return [];
  const content = await file.text();
  const allLines = linesFromText(content);
  const tail = allLines.slice(-maxLines);
  const parsed: HistoryEntry[] = [];
  for (let i = 0; i < tail.length; i++) {
    const e = parseHistoryLine(tail[i]);
    if (e) parsed.push(e);
  }
  return parsed;
}

export async function findLatestSessionIdForPrompt(
  prompt: string,
  options: { sinceTs?: number; filePath?: string; windowLines?: number } = {},
): Promise<string | null> {
  const windowLines = options.windowLines ?? 800;
  const entries = await readHistoryTail({ filePath: options.filePath, maxLines: windowLines });
  if (entries.length === 0) return null;
  const target = normalizeNewlines(prompt);
  const sinceTs = options.sinceTs ?? 0;

  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.ts < sinceTs) continue;
    if (normalizeNewlines(e.text) === target) return e.session_id;
  }
  return null;
}

export async function waitForSessionIdForPrompt(
  prompt: string,
  options: {
    sinceTs?: number; // only consider entries with ts >= sinceTs
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

  const target = normalizeNewlines(prompt);

  while (Date.now() < deadline) {
    try {
      const entries = await readHistoryTail({ filePath, maxLines: 1000 });
      for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i];
        if (e.ts < sinceTs) continue;
        if (normalizeNewlines(e.text) === target) {
          logger.info({ sinceTs, ts: e.ts, sessionId: e.session_id }, 'Found Codex session id');
          return e.session_id;
        }
      }
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Error reading Codex history tail',
      );
    }
    await Bun.sleep(pollIntervalMs);
  }
  logger.warn({ timeoutMs, sinceTs }, 'Timeout waiting for Codex session id');
  return null;
}

