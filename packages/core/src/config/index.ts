import { getClaudeCodePath } from '../utils/env';
import { validateEnv } from './env.schema';

// Base config without inference
const baseConfig = validateEnv();

// Initialize config with Claude Code path from config file
let _config = baseConfig;
let _initialized = false;

async function initializeConfig() {
  if (_initialized) return _config;

  // Get CLAUDE_CODE_PATH from config file if not provided in env
  if (!baseConfig.CLAUDE_CODE_PATH) {
    try {
      const claudeCodePath = await getClaudeCodePath();
      _config = { ...baseConfig, CLAUDE_CODE_PATH: claudeCodePath };
    } catch (error) {
      console.error('Failed to get CLAUDE_CODE_PATH:', error);
      throw new Error('CLAUDE_CODE_PATH must be provided or run `pokecode setup` to configure it');
    }
  }

  _initialized = true;
  return _config;
}

// Export a function to get initialized config
export async function getConfig() {
  return await initializeConfig();
}

// Export synchronous config for backwards compatibility (but requires CLAUDE_CODE_PATH to be set manually)
export const config = baseConfig;

export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';

// Rate limit configurations
export const rateLimitConfig = {
  prompt: {
    max: 10,
    timeWindow: '1 minute',
  },
  file: {
    max: 100,
    timeWindow: '1 minute',
  },
  read: {
    max: 1000,
    timeWindow: '1 minute',
  },
};

// File storage configuration
export const fileStorageConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedExtensions: [
    '.js',
    '.ts',
    '.jsx',
    '.tsx',
    '.json',
    '.md',
    '.txt',
    '.html',
    '.css',
    '.scss',
    '.less',
    '.py',
    '.java',
    '.cpp',
    '.c',
    '.h',
    '.hpp',
    '.rs',
    '.go',
    '.rb',
    '.php',
    '.swift',
    '.kt',
    '.yaml',
    '.yml',
    '.toml',
    '.xml',
    '.sh',
    '.bash',
    '.zsh',
    '.fish',
    '.gitignore',
    '.dockerignore',
    'Dockerfile',
    'Makefile',
  ],
};

// Re-export env as alias for config for compatibility
export const env = config;
