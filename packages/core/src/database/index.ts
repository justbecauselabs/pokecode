import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { type BunSQLiteDatabase, drizzle } from 'drizzle-orm/bun-sqlite';
import { DATABASE_PATH } from '../config';
import { DatabaseMigrator } from './migrator';
import * as schema from './schema-sqlite';

// Single database instance
let sqlite: Database;
let db: BunSQLiteDatabase<typeof schema>;

function initializeDatabase() {
  if (db) return; // Already initialized

  // Ensure directory exists
  try {
    mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });
  } catch (_error) {
    // Directory might already exist
  }

  // Create SQLite connection
  sqlite = new Database(DATABASE_PATH);

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
    throw error; // Propagate error instead of swallowing it
  });
}

// Export initialization function for explicit control
export { initializeDatabase };

// Initialize on first access to allow config overrides
function ensureInitialized() {
  if (!db) {
    initializeDatabase();
  }
}

// Lazy getter for database
export function getDatabase(): BunSQLiteDatabase<typeof schema> {
  ensureInitialized();
  return db;
}

// Lazy getter for sqlite
export function getSqlite(): Database {
  ensureInitialized();
  return sqlite;
}

// Initialize immediately to maintain backward compatibility
initializeDatabase();

// Export the instances
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
