import { inferClaudeCodeCliPath } from '../utils/infer';

const p = await inferClaudeCodeCliPath();
console.log(`inferClaudeCodeCliPath: ${p ?? 'null'}`);

