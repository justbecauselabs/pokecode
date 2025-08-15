import { $ } from 'bun';

// Set test environment
process.env.BUN_TEST = '1';
process.env.NODE_ENV = 'test';

// Push database schema before running tests
await $`bunx drizzle-kit push`.quiet();
