import { validateEnv } from './env.schema';

export const config = validateEnv();

export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';

// Database connection string
export const getDatabaseUrl = () => {
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = config;
  return `postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
};

// JWT configuration
export const jwtConfig = {
  access: {
    secret: config.JWT_ACCESS_SECRET,
    expiresIn: '15m',
  },
  refresh: {
    secret: config.JWT_REFRESH_SECRET,
    expiresIn: '7d',
  },
};

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
