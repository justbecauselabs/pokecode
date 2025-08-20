import { Database } from 'bun:sqlite';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { config } from '@/config';
import { isTest } from '@/utils/env';
import { createChildLogger } from '@/utils/logger';
import * as schema from './schema-sqlite';

const logger = createChildLogger('database');

// Determine database path based on environment
function getDatabasePath(): string {
  if (isTest()) {
    return path.join(process.cwd(), 'tests', 'data', 'pokecode.db');
  }

  return config.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'pokecode.db');
}

const dbPath = getDatabasePath();

// Ensure data directory exists
import { mkdirSync } from 'node:fs';

mkdirSync(path.dirname(dbPath), { recursive: true });

// Create optimized SQLite connection
const sqlite = new Database(dbPath, {
  strict: true, // Enable strict mode for better SQL compliance
});

// Enable WAL mode for better concurrency
sqlite.exec('PRAGMA journal_mode = WAL;');
sqlite.exec('PRAGMA synchronous = NORMAL;'); // Faster writes with good durability
sqlite.exec('PRAGMA cache_size = 1000000000;'); // 1GB cache
sqlite.exec('PRAGMA foreign_keys = ON;'); // Enable foreign key constraints
sqlite.exec('PRAGMA temp_store = MEMORY;'); // Store temp data in memory

export const db = drizzle(sqlite, { schema });

// Export the underlying sqlite instance for raw queries if needed
export { sqlite };

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = sqlite.query('SELECT 1 as health').get();
    return result !== null;
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return false;
  }
}

// Close database connection gracefully
export function closeDatabase(): void {
  try {
    sqlite.close();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error({ error }, 'Error closing database');
  }
}

// Note: Graceful shutdown should be handled by the application (server/worker)
// not by the database module to avoid duplicate handlers
