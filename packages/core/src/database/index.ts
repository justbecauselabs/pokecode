import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { type BunSQLiteDatabase, drizzle } from 'drizzle-orm/bun-sqlite';
import { DatabaseMigrator } from './migrator';
import * as schema from './schema-sqlite';

export interface DatabaseConfig {
  dbPath?: string;
  isTest?: boolean;
  enableWAL?: boolean;
  cacheSize?: number;
}

export class DatabaseManager {
  private sqlite: Database;
  private db: BunSQLiteDatabase<typeof schema>;

  constructor(config: DatabaseConfig = {}) {
    const dbPath = this.getDatabasePath(config);

    // Ensure data directory exists synchronously for now
    try {
      mkdirSync(path.dirname(dbPath), { recursive: true });
    } catch (_error) {
      // Directory might already exist
    }

    // Create optimized SQLite connection
    this.sqlite = new Database(dbPath);

    this.configureSQLite(config);
    this.db = drizzle(this.sqlite, { schema });
  }

  private getDatabasePath(config: DatabaseConfig): string {
    if (config.dbPath) {
      return config.dbPath;
    }

    if (config.isTest) {
      return path.join(process.cwd(), 'tests', 'data', 'pokecode.db');
    }

    // Default to ~/.pokecode/data/pokecode.db
    return path.join(homedir(), '.pokecode', 'data', 'pokecode.db');
  }

  private configureSQLite(config: DatabaseConfig): void {
    if (config.enableWAL !== false) {
      // Enable WAL mode for better concurrency
      this.sqlite.exec('PRAGMA journal_mode = WAL;');
    }

    this.sqlite.exec('PRAGMA synchronous = NORMAL;'); // Faster writes with good durability
    this.sqlite.exec(`PRAGMA cache_size = ${config.cacheSize || 1000000};`); // 1GB cache default
    this.sqlite.exec('PRAGMA foreign_keys = ON;'); // Enable foreign key constraints
    this.sqlite.exec('PRAGMA temp_store = MEMORY;'); // Store temp data in memory
  }

  getDb() {
    return this.db;
  }

  getSqlite() {
    return this.sqlite;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const result = this.sqlite.query('SELECT 1 as health').get();
      return result !== null;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  async ensureTablesExist(): Promise<void> {
    try {
      const migrator = new DatabaseMigrator(this.sqlite);
      await migrator.migrate();
    } catch (error) {
      console.error('Failed to run database migrations:', error);
      throw error;
    }
  }

  close(): void {
    try {
      this.sqlite.close();
    } catch (error) {
      console.error('Error closing database:', error);
    }
  }
}

// Create lazy-initialized default database instance for backward compatibility
let defaultDb: DatabaseManager | null = null;

function getDefaultDb() {
  if (!defaultDb) {
    defaultDb = new DatabaseManager();
  }
  return defaultDb;
}

export function getDb() {
  return getDefaultDb().getDb();
}

export function getSqlite() {
  return getDefaultDb().getSqlite();
}

// For backward compatibility, but these will throw if called at import time
// Services should use the functions instead
export let db: ReturnType<DatabaseManager['getDb']>;
export let sqlite: ReturnType<DatabaseManager['getSqlite']>;

// Initialize on first access
try {
  const defaultInstance = getDefaultDb();
  db = defaultInstance.getDb();
  sqlite = defaultInstance.getSqlite();
} catch {
  // Will be initialized later when actually needed
}

// Export schema for external use
export { schema };
export { migrations } from './migrations';

// Export migration utilities
export { DatabaseMigrator } from './migrator';
export * from './schema-sqlite';

// Export the health check function for backward compatibility
export async function checkDatabaseHealth(): Promise<boolean> {
  return getDefaultDb().checkHealth();
}

// Export the close function for backward compatibility
export function closeDatabase(): void {
  if (defaultDb) {
    defaultDb.close();
    defaultDb = null;
  }
}
