import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { type BunSQLiteDatabase, drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { DATABASE_PATH } from '../config';
import * as schema from './schema-sqlite';

// Single database instance
let sqlite: Database;
let db: BunSQLiteDatabase<typeof schema>;

// Resolve migrations folder next to this module (works in dev and with embedded assets)
function resolveMigrationsFolder(): string {
  const url = new URL('./migrations', import.meta.url);
  return url.pathname;
}

export async function initDatabase(params: { runMigrations?: boolean } = {}): Promise<
  BunSQLiteDatabase<typeof schema>
> {
  if (!db) {
    try {
      mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });
    } catch (_error) {}

    sqlite = new Database(DATABASE_PATH);
    sqlite.exec('PRAGMA journal_mode = WAL;');
    sqlite.exec('PRAGMA synchronous = NORMAL;');
    sqlite.exec('PRAGMA cache_size = 1000000;');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    sqlite.exec('PRAGMA temp_store = MEMORY;');
    db = drizzle(sqlite, { schema });
  }

  if (params.runMigrations) {
    const migrationsFolder = resolveMigrationsFolder();
    await migrate(db, { migrationsFolder });
  }

  return db;
}

// Initialize on first access to allow config overrides
function ensureInitialized() {
  if (!db) {
    // Initialize without running migrations; caller should run them explicitly
    void initDatabase({ runMigrations: false });
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

// Export the instances
export { db, sqlite };

// Export schema and utilities
export { schema };
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
