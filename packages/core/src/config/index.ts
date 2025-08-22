import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

export interface Config {
  // Server
  port: number;
  host: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

  // Database
  databaseWAL: boolean;
  databaseCacheSize: number;

  // File Config
  claudeCodePath: string;
  repositories: string[];

  // Worker
  workerConcurrency: number;
  workerPollingInterval: number;
  jobRetention: number; // days
  maxJobAttempts: number;
}

export const CONFIG_DIR = join(homedir(), '.pokecode');
export const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
export const DATABASE_PATH = join(CONFIG_DIR, 'pokecode.db');
export const LOG_FILE = join(CONFIG_DIR, 'pokecode.log');
export const PID_FILE = join(CONFIG_DIR, 'pokecode.pid');
export const DAEMON_FILE = join(CONFIG_DIR, 'daemon.json');

const defaultConfig: Config = {
  port: 3001,
  host: '0.0.0.0',
  logLevel: 'info',
  databaseWAL: true,
  databaseCacheSize: 1000000, // 1GB
  claudeCodePath: '',
  repositories: [],
  workerConcurrency: 5,
  workerPollingInterval: 1000,
  jobRetention: 30, // days
  maxJobAttempts: 1,
};

const fileConfigSchema = z.object({
  repositories: z.array(z.string()),
  claudeCodePath: z.string(),
});

export type FileConfig = z.infer<typeof fileConfigSchema>;

let configOverrides: Partial<Config> | undefined;

export async function getConfig(): Promise<Config> {
  const configFile = Bun.file(CONFIG_FILE);
  let fileConfig: FileConfig | undefined;
  if (await configFile.exists()) {
    const content = await configFile.text();
    fileConfig = fileConfigSchema.parse(JSON.parse(content));
  } else {
    throw new Error('.pokecode/config.json not found. Please run `pokecode setup`.');
  }

  return {
    ...defaultConfig,
    ...fileConfig,
    ...configOverrides,
  };
}

// Set temporary overrides for CLI commands
export function overrideConfig(overrides: Partial<Config>): void {
  configOverrides = { ...configOverrides, ...overrides };
}

// Clear all overrides (useful for tests or resetting)
export function clearConfigOverrides(): void {
  configOverrides = {};
}

// Helper functions for backwards compatibility and specific needs
export const isTest =
  typeof (globalThis as Record<string, unknown>).test !== 'undefined' ||
  process.argv.some((arg) => arg.includes('bun test') || arg.includes('test'));
