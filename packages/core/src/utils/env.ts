import { homedir } from 'node:os';
import { join } from 'node:path';

export function isTest(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.BUN_TEST === '1' ||
    typeof (globalThis as Record<string, unknown>).test !== 'undefined' ||
    process.argv.some((arg) => arg.includes('bun test') || arg.includes('test'))
  );
}

export async function getClaudeCodePath(): Promise<string> {
  try {
    const configPath = join(homedir(), '.pokecode', 'config.json');
    const configFile = Bun.file(configPath);

    if (!(await configFile.exists())) {
      throw new Error('Configuration not found. Please run `pokecode setup` first.');
    }

    const configContent = await configFile.text();
    const config = JSON.parse(configContent);

    if (!config.claudeCodePath) {
      throw new Error('Claude Code path not configured. Please run `pokecode setup` first.');
    }

    return config.claudeCodePath;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to read Claude Code path from config.');
  }
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
