import { dirname, join } from 'node:path';

function extractPathFromWhichOutput(out: string, cmd: string): string | null {
  const trimmed = out.trim();
  if (trimmed.length === 0) return null;
  const aliasZsh = new RegExp(`^${cmd}:[\t ]*aliased to[\t ]+(.+)$`);
  const m1 = trimmed.match(aliasZsh);
  if (m1?.[1]) return m1[1].trim();
  const aliasBash = new RegExp(`^alias[\t ]+${cmd}=['"]([^'"]+)['"]$`);
  const m2 = trimmed.match(aliasBash);
  if (m2?.[1]) return m2[1].trim();
  if (trimmed.startsWith('/')) return trimmed;
  for (const token of trimmed.split(/\s+/)) {
    if (token.startsWith('/')) return token;
  }
  return null;
}

async function runStdout(cmd: string[]): Promise<string> {
  try {
    const proc = Bun.spawn({ cmd, stdout: 'pipe', stderr: 'pipe', stdin: 'ignore' });
    await proc.exited;
    const out = proc.stdout ? await new Response(proc.stdout).text() : '';
    return out.trim();
  } catch {
    return '';
  }
}

async function commandPath(cmd: string): Promise<string | null> {
  console.log('Trying to detect claude code path');
  // Basic PATH-resolved checks
  // const out1 = await runStdout(['/bin/sh', '-lc', `command -v ${cmd}`]);
  // console.log('out1', out1);
  // const p1 = extractPathFromWhichOutput(out1, cmd);
  // if (p1) return p1;

  const out2 = await runStdout(['which', cmd]);
  console.log('out2', out2);
  const p2 = extractPathFromWhichOutput(out2, cmd);
  if (p2) return p2;

  // zsh (login and interactive) to see aliases from ~/.zshrc
  const out3 = await runStdout(['zsh', '-lc', `which ${cmd}`]);
  console.log('out3', out3);

  const p3 = extractPathFromWhichOutput(out3, cmd);
  if (p3) return p3;

  const out4 = await runStdout(['zsh', '-lc', `whence -p ${cmd} || print -r -- $commands[${cmd}]`]);
  console.log('out4', out4);

  const p4 = extractPathFromWhichOutput(out4, cmd);
  if (p4) return p4;

  const out5 = await runStdout(['zsh', '-ic', `which ${cmd}`]);
  console.log('out5', out5);

  const p5 = extractPathFromWhichOutput(out5, cmd);
  if (p5) return p5;

  const out6 = await runStdout(['zsh', '-ic', `whence -p ${cmd} || print -r -- $commands[${cmd}]`]);
  console.log('out6', out6);

  const p6 = extractPathFromWhichOutput(out6, cmd);
  if (p6) return p6;

  return null;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    return await Bun.file(p).exists();
  } catch {
    return false;
  }
}

async function tryPaths(paths: string[]): Promise<string | null> {
  for (const p of paths) {
    if (await fileExists(p)) return p;
  }
  return null;
}

function candidateClaudeCliFromBin(binPath: string): string[] {
  const candidates: string[] = [];
  const binDir = dirname(binPath);
  // Local install pattern: <dir>/claude with <dir>/node_modules
  candidates.push(join(binDir, 'node_modules/@anthropic-ai/claude-code/cli.js'));
  candidates.push(join(binDir, 'lib/node_modules/@anthropic-ai/claude-code/cli.js'));

  // .bin symlink pattern: <root>/node_modules/.bin/claude
  if (binDir.endsWith('/.bin')) {
    const nm = dirname(binDir); // <root>/node_modules
    candidates.push(join(nm, '@anthropic-ai/claude-code/cli.js'));
    const root = dirname(nm);
    candidates.push(join(root, 'node_modules/@anthropic-ai/claude-code/cli.js'));
  }

  return candidates;
}

async function parseWrapperForClaudePath(binPath: string): Promise<string | null> {
  try {
    const content = await Bun.file(binPath).text();
    const match = content.match(/(["'])((?:[^"']*?@anthropic-ai\/claude-code\/cli\.js))["']/);
    if (match?.[2]) {
      const p = match[2];
      if (await fileExists(p)) return p;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function inferClaudeCodeCliPath(): Promise<string | null> {
  const bin = await commandPath('claude');
  if (!bin) return null;
  // Try to read wrapper and extract explicit path or derive from .bin
  const fromWrapper = await parseWrapperForClaudePath(bin);
  const candidates = candidateClaudeCliFromBin(bin);
  if (fromWrapper) candidates.unshift(fromWrapper);
  const found = await tryPaths(candidates);
  return found;
}

export async function inferCodexCliPath(): Promise<string | null> {
  const bin = await commandPath('codex');
  if (!bin) return null;

  // Basic validation by trying --version (non-fatal)
  try {
    const proc = Bun.spawn({ cmd: [bin, '--version'], stdout: 'pipe', stderr: 'pipe' });
    await proc.exited;
  } catch {
    // ignore
  }
  return bin;
}
