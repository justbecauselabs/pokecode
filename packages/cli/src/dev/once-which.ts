import { inferClaudeCodeCliPath } from '../utils/infer';

async function run(cmd: string[]): Promise<string> {
  const p = Bun.spawn({ cmd, stdout: 'pipe', stderr: 'pipe', stdin: 'ignore' });
  await p.exited;
  const out = p.stdout ? await new Response(p.stdout).text() : '';
  const err = p.stderr ? await new Response(p.stderr).text() : '';
  return `${out.trim()}${err ? ` | err: ${err.trim()}` : ''}`;
}

console.log('sh -lc which claude ->', await run(['/bin/sh', '-lc', 'which claude']));
console.log('zsh -lc which claude ->', await run(['zsh', '-lc', 'which claude']));
console.log('zsh -ic which claude ->', await run(['zsh', '-ic', 'which claude']));
console.log('zsh -ic alias claude ->', await run(['zsh', '-ic', 'alias claude']));

console.log('inferClaudeCodeCliPath ->', await inferClaudeCodeCliPath());

