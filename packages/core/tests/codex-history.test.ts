import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import os from 'node:os';
import { join } from 'node:path';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { waitForSessionIdForPrompt } from '../src/utils/codex-history';

let sessionsDir: string;

async function createSessionFile(params: {
  relativePath: string;
  lines: string[];
}): Promise<void> {
  const fullPath = join(sessionsDir, params.relativePath);
  await mkdir(dirname(fullPath), { recursive: true });
  await Bun.write(fullPath, `${params.lines.join('\n')}\n`);
}

describe('waitForSessionIdForPrompt', () => {
  beforeEach(async () => {
    sessionsDir = await mkdtemp(join(os.tmpdir(), 'codex-sessions-test-'));
  });

  afterEach(async () => {
    await rm(sessionsDir, { recursive: true, force: true });
  });

  it('resolves when the marker appears within timeout', async () => {
    const marker = 'Ignore this id: marker-appears';
    const sessionId = '11111111-1111-4111-8111-111111111111';

    setTimeout(async () => {
      await createSessionFile({
        relativePath: `2025/09/16/rollout-2025-09-16T12-00-00-${sessionId}.jsonl`,
        lines: [
          JSON.stringify({ timestamp: '2025-09-16T12:00:00Z', marker: false }),
          `INFO: logs\n${marker}`,
        ],
      });
    }, 50);

    const found = await waitForSessionIdForPrompt(marker, {
      sessionsDir,
      timeoutMs: 2_000,
      pollIntervalMs: 20,
    });

    expect(found).toBe(sessionId);
  });

  it('uses the newest session file when multiple match', async () => {
    const marker = 'Ignore this id: find-later';
    const oldSession = '22222222-2222-4222-8222-222222222222';
    const newSession = '33333333-3333-4333-8333-333333333333';

    await createSessionFile({
      relativePath: `2025/09/15/rollout-2025-09-15T11-00-00-${oldSession}.jsonl`,
      lines: ['old file without marker'],
    });

    setTimeout(async () => {
      await createSessionFile({
        relativePath: `2025/09/16/rollout-2025-09-16T12-00-00-${newSession}.jsonl`,
        lines: [`new file ${marker}`],
      });
    }, 50);

    const found = await waitForSessionIdForPrompt(marker, {
      sessionsDir,
      timeoutMs: 2_000,
      pollIntervalMs: 20,
    });

    expect(found).toBe(newSession);
  });

  it('handles CRLF line endings when searching for the marker', async () => {
    const marker = 'Ignore this id: crlf-test';
    const sessionId = '44444444-4444-4444-8444-444444444444';

    await createSessionFile({
      relativePath: `2025/09/16/rollout-2025-09-16T13-00-00-${sessionId}.jsonl`,
      lines: [`Line A\r\nLine B\r\n${marker}`],
    });

    const found = await waitForSessionIdForPrompt(marker, {
      sessionsDir,
      timeoutMs: 1_000,
      pollIntervalMs: 20,
    });

    expect(found).toBe(sessionId);
  });

  it('returns null when the marker never appears', async () => {
    const marker = 'Ignore this id: never';

    await createSessionFile({
      relativePath: '2025/09/16/rollout-2025-09-16T10-00-00-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jsonl',
      lines: ['some other content'],
    });

    const found = await waitForSessionIdForPrompt(marker, {
      sessionsDir,
      timeoutMs: 200,
      pollIntervalMs: 20,
    });

    expect(found).toBeNull();
  });

  it('extracts the session id from the filename when the marker is inside logs', async () => {
    const marker = 'Ignore this id: inspect';
    const sessionId = '55555555-5555-4555-8555-555555555555';

    await createSessionFile({
      relativePath: `2025/09/16/rollout-2025-09-16T14-00-00-${sessionId}.jsonl`,
      lines: [
        'INFO: Running Codex CLI',
        'args: [...]',
        `marker -> ${marker}`,
      ],
    });

    const found = await waitForSessionIdForPrompt(marker, {
      sessionsDir,
      timeoutMs: 1_000,
      pollIntervalMs: 20,
    });

    expect(found).toBe(sessionId);
  });
});
