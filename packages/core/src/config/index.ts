import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

export interface Config {
  // Server
  port: number;
  host: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

  // Database
  databasePath: string;
  databaseWAL: boolean;
  databaseCacheSize: number;

  // Paths
  configDir: string; // Base config directory (~/.pokecode)
  claudeCodePath: string | undefined;
  codexCliPath: string | undefined;
  repositories: string[];
  configFile: string;
  logFile: string;
  pidFile: string;
  daemonFile: string;

  // Worker
  workerConcurrency: number;
  workerPollingInterval: number;
  jobRetention: number; // days
  maxJobAttempts: number;
}

const BASE_CONFIG_DIR = join(homedir(), '.pokecode');

// Check if we're in test environment
// Set NODE_ENV=test when running tests to use in-memory database
const isTestEnv = process.env.NODE_ENV === 'test';

const defaultConfig: Config = {
  port: 3001,
  host: '0.0.0.0',
  logLevel: 'info',
  configDir: BASE_CONFIG_DIR,
  databasePath: isTestEnv ? ':memory:' : join(BASE_CONFIG_DIR, 'pokecode.db'),
  databaseWAL: true,
  databaseCacheSize: 1000000, // 1GB
  claudeCodePath: undefined,
  codexCliPath: undefined,
  repositories: [],
  configFile: join(BASE_CONFIG_DIR, 'config.json'),
  logFile: join(BASE_CONFIG_DIR, 'pokecode.log'),
  pidFile: join(BASE_CONFIG_DIR, 'pokecode.pid'),
  daemonFile: join(BASE_CONFIG_DIR, 'daemon.json'),
  workerConcurrency: 5,
  workerPollingInterval: 1000,
  jobRetention: 30, // days
  maxJobAttempts: 1,
};

const fileConfigSchema = z.object({
  repositories: z.array(z.string()),
  claudeCodePath: z.string(),
  codexCliPath: z.string().optional(),
});

export type FileConfig = z.infer<typeof fileConfigSchema>;

let configOverrides: Partial<Config> | undefined;

export async function getConfig(): Promise<Config> {
  const configFile = Bun.file(defaultConfig.configFile);
  let fileConfig: FileConfig | undefined;
  if (await configFile.exists()) {
    const content = await configFile.text();
    fileConfig = fileConfigSchema.parse(JSON.parse(content));
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

// Export constants for backward compatibility
export const CONFIG_DIR = BASE_CONFIG_DIR;
export const CONFIG_FILE = join(BASE_CONFIG_DIR, 'config.json');
export const LOG_FILE = join(BASE_CONFIG_DIR, 'pokecode.log');
export const DATABASE_PATH = isTestEnv ? ':memory:' : join(BASE_CONFIG_DIR, 'pokecode.db');
export const PID_FILE = join(BASE_CONFIG_DIR, 'pokecode.pid');
export const DAEMON_FILE = join(BASE_CONFIG_DIR, 'daemon.json');
