import { $ } from 'bun';

// Set test environment
process.env.BUN_TEST = '1';
process.env.NODE_ENV = 'test';

// Push database schema before running tests
console.log('🚀 Running database push before tests...');
await $`bunx drizzle-kit push`.quiet();
console.log('✅ Database schema synced');
