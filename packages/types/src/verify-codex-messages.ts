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
    console.error(`[FAIL] File not found: ${filePath}`);
    Bun.exit(1);
    return;
  }

  const content = await file.text();
  const lines = content.split(/\r?\n/);

  let total = 0;
  let parsed = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw || raw.trim().length === 0) continue;
    total++;
    let obj: unknown;
    try {
      obj = parseJson(raw);
    } catch (e) {
      console.error(`[FAIL] Line ${i + 1}: invalid JSON`);
      console.error(raw);
      console.error(e instanceof Error ? e.message : String(e));
      Bun.exit(1);
      return;
    }
    const result = CodexSDKOrEnvelopeSchema.safeParse(obj);
    if (!result.success) {
      console.error(`[FAIL] Line ${i + 1}: schema validation failed`);
      console.error(JSON.stringify(result.error.issues, null, 2));
      console.error('Object:');
      console.error(JSON.stringify(obj, null, 2));
      process.exit(1);
      return;
    }
    parsed++;
  }

  console.log(`[OK] Parsed ${parsed}/${total} JSONL lines from ${filePath}`);
}

await main();
