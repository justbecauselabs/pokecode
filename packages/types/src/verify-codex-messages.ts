import { CodexSDKOrEnvelopeSchema } from './codex';

// Simple JSON parser with unknown output for Zod validation
function parseJson(input: string): unknown {
  return JSON.parse(input);
}

async function main(): Promise<void> {
  const argPath = Bun.argv.length > 2 ? Bun.argv[2] : undefined;
  const filePath = argPath && argPath.trim().length > 0 ? argPath : 'codex-messages.jsonl';

  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = await file.text();
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw || raw.trim().length === 0) continue;
    let obj: unknown;
    try {
      obj = parseJson(raw);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      throw new Error(`Invalid JSON at line ${i + 1}: ${detail}`);
    }
    const result = CodexSDKOrEnvelopeSchema.safeParse(obj);
    if (!result.success) {
      throw new Error(`Schema validation failed at line ${i + 1}`);
    }
  }
}

await main();
