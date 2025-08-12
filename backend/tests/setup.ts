// Set test environment variables FIRST before any imports
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.DB_NAME = 'pokecode_tests';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.CLAUDE_CODE_PATH = '/usr/local/bin/claude-code'; // Mock path for tests
process.env.GITHUB_REPOS_DIRECTORY = '/tmp/test-repos';
process.env.JWT_ACCESS_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.FRONTEND_URL = 'http://localhost:3000';

import { config } from 'dotenv';
import path from 'node:path';
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Load additional test environment variables from file (will override defaults if needed)
config({ path: path.resolve(__dirname, '..', '.env.test') });

// Import after environment is set
import { initTestDatabase, cleanupTestDatabase, closeTestDatabase } from './helpers/database.helpers';
import { resetClaudeDirectoryMocks } from './helpers/claude-directory.mock';

// Global test setup
beforeAll(async () => {
  // Initialize test database for all tests (will fallback to mock if connection fails)
  await initTestDatabase();
});

afterAll(async () => {
  // Close database connection
  await closeTestDatabase();
});

beforeEach(async () => {
  // Clean database for tests that use real database
  if (process.env.VITEST_POOL_ID?.includes('integration') || 
      process.argv.some(arg => arg.includes('integration')) ||
      // Also clean for service tests that need database
      process.env.VITEST_POOL_ID?.includes('file.service') ||
      process.env.VITEST_POOL_ID?.includes('queue.service')) {
    await cleanupTestDatabase();
  }
});

afterEach(() => {
  // Reset all mocks after each test
  resetClaudeDirectoryMocks();
});