import { homedir } from 'node:os';
import { join } from 'node:path';
import { logger } from './logger';

export function isTest(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.BUN_TEST === '1' ||
    typeof (globalThis as Record<string, unknown>).test !== 'undefined' ||
    process.argv.some((arg) => arg.includes('bun test') || arg.includes('test'))
  );
}

export async function inferClaudeCodePath(): Promise<string> {
  logger.debug('Inferring Claude Code path');
  const proc = Bun.spawn(['which', 'claude'], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error('claude command not found in PATH');
  }

  // Extract the path from output like "claude: aliased to /Users/billy/.claude/local/claude"
  const match = output.trim().match(/aliased to (.+)/) || [null, output.trim()];
  const claudePath = match[1] || output.trim();

  // Replace the last "/claude" with "node_modules/@anthropic-ai/claude-code/cli.js"
  const claudeCodePath = claudePath.replace(
    /\/claude$/,
    '/node_modules/@anthropic-ai/claude-code/cli.js',
  );

  logger.debug('Claude Code path inferred', { claudeCodePath });

  return claudeCodePath;
}

export async function getRepositoryPaths(): Promise<string[]> {
  try {
    const configPath = join(homedir(), '.pokecode', 'config.json');
    const configFile = Bun.file(configPath);

    if (!(await configFile.exists())) {
      return [];
    }

    const configContent = await configFile.text();
    const config = JSON.parse(configContent);

    return config.repositories || [];
  } catch (error) {
    console.warn(
      `Failed to read repositories from config: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    return [];
  }
}
