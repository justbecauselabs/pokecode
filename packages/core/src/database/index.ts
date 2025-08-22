import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path, { join } from 'node:path';
import { type BunSQLiteDatabase, drizzle } from 'drizzle-orm/bun-sqlite';
import { DatabaseMigrator } from './migrator';
import * as schema from './schema-sqlite';

// Single database instance - use defaults that can be overridden by config
const BASE_CONFIG_DIR = join(homedir(), '.pokecode');
let dbPath: string;
let sqlite: Database;
let db: BunSQLiteDatabase<typeof schema>;

function initializeDatabase() {
  if (db) return; // Already initialized

  // Use default path - matches config BASE_CONFIG_DIR
  dbPath = join(BASE_CONFIG_DIR, 'data', 'pokecode.db');

  // Ensure data directory exists
  try {
    mkdirSync(path.dirname(dbPath), { recursive: true });
  } catch (_error) {
    // Directory might already exist
  }

  // Create SQLite connection
  sqlite = new Database(dbPath);

  // Configure SQLite with sensible defaults
  sqlite.exec('PRAGMA journal_mode = WAL;');
  sqlite.exec('PRAGMA synchronous = NORMAL;');
  sqlite.exec('PRAGMA cache_size = 1000000;'); // 1GB
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec('PRAGMA temp_store = MEMORY;');

  // Create Drizzle instance
  db = drizzle(sqlite, { schema });

  // Run migrations
  const migrator = new DatabaseMigrator(sqlite);
  migrator.migrate().catch((error) => {
    console.error('Failed to run database migrations:', error);
  });
}

// Initialize immediately
initializeDatabase();

// Export the single instance
export { db, sqlite };

// Export schema and utilities
export { schema };
export { migrations } from './migrations';
export { DatabaseMigrator } from './migrator';
export * from './schema-sqlite';

// Simple health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = sqlite.query('SELECT 1 as health').get();
    return result !== null;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Simple close function
export function closeDatabase(): void {
  try {
    sqlite?.close();
  } catch (error) {
    console.error('Error closing database:', error);
  }
}
