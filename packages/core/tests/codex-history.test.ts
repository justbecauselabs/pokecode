import { describe, it, expect } from 'bun:test';
import os from 'node:os';
import path from 'node:path';
import { waitForSessionIdForPrompt } from '../src/utils/codex-history';

function tmpHistoryPath(suffix: string): string {
  return path.join(os.tmpdir(), `codex-history-test-${suffix}.jsonl`);
}

async function writeHistory(filePath: string, entries: Array<{ session_id: string; ts: number; text: string }>): Promise<void> {
  const payload = entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length > 0 ? '\n' : '');
  await Bun.write(filePath, payload);
}

describe('waitForSessionIdForPrompt', () => {
  it('resolves when the prompt appears within timeout', async () => {
    const filePath = tmpHistoryPath('appears');
    await writeHistory(filePath, []);

    const marker = 'Ignore this id: marker-appears';
    const nowSec = Math.floor(Date.now() / 1000);
    const sessionId = 'test-session-1';

    // Schedule append after a short delay with additional logging content
    setTimeout(async () => {
      const logWrapped = `LOG START\n${marker}\nLOG END`;
      await writeHistory(filePath, [
        { session_id: sessionId, ts: nowSec + 1, text: logWrapped },
      ]);
    }, 50);

    const found = await waitForSessionIdForPrompt(marker, {
      sinceTs: nowSec,
      timeoutMs: 2_000,
      pollIntervalMs: 20,
      filePath,
    });

    expect(found).toBe(sessionId);
  });

  it('ignores entries older than sinceTs and resolves with a newer one', async () => {
    const filePath = tmpHistoryPath('since');
    const marker = 'Ignore this id: find-later';
    const nowSec = Math.floor(Date.now() / 1000);

    // Write an older matching entry
    await writeHistory(filePath, [
      { session_id: 'old-one', ts: nowSec - 10, text: `prefix ${marker} suffix` },
    ]);

    // Append a new valid entry shortly after
    const newId = 'new-one';
    setTimeout(async () => {
      const current = await Bun.file(filePath).text();
      const extra = JSON.stringify({
        session_id: newId,
        ts: nowSec + 1,
        text: `event::${marker}::done`,
      });
      await Bun.write(filePath, `${current}${extra}\n`);
    }, 50);

    const found = await waitForSessionIdForPrompt(marker, {
      sinceTs: nowSec - 5,
      timeoutMs: 2_000,
      pollIntervalMs: 20,
      filePath,
    });

    expect(found).toBe(newId);
  });

  it('normalizes CRLF in stored history against LF prompt', async () => {
    const filePath = tmpHistoryPath('crlf');
    const marker = 'Ignore this id: crlf-test';
    const crlfText = `Line A\r\nLine B\r\n${marker}`;
    const nowSec = Math.floor(Date.now() / 1000);
    const id = 'crlf-id';
    await writeHistory(filePath, [
      { session_id: id, ts: nowSec, text: crlfText },
    ]);

    const found = await waitForSessionIdForPrompt(marker, {
      sinceTs: nowSec - 1,
      timeoutMs: 500,
      pollIntervalMs: 20,
      filePath,
    });
    expect(found).toBe(id);
  });

  it('returns null when prompt does not appear before timeout', async () => {
    const filePath = tmpHistoryPath('timeout');
    await writeHistory(filePath, []);
    const marker = 'Ignore this id: never';
    const nowSec = Math.floor(Date.now() / 1000);
    const found = await waitForSessionIdForPrompt(marker, {
      sinceTs: nowSec,
      timeoutMs: 200,
      pollIntervalMs: 20,
      filePath,
    });
    expect(found).toBeNull();
  });

  it('matches prompt embedded within operational logs', async () => {
    const filePath = tmpHistoryPath('log-wrap');
    const nowSec = Math.floor(Date.now() / 1000);
    const marker = 'Ignore this id: inspect';
    const sessionId = 'log-session';

    const logEntry = `INFO: Running Codex CLI\nargs: [\n  "--json",\n  "prompt text"\n]\nINFO: done\n${marker}`;
    await writeHistory(filePath, [
      { session_id: sessionId, ts: nowSec + 1, text: logEntry },
    ]);

    const found = await waitForSessionIdForPrompt(marker, {
      sinceTs: nowSec,
      timeoutMs: 1_000,
      pollIntervalMs: 20,
      filePath,
    });

    expect(found).toBe(sessionId);
  });
});
