import { Database } from 'bun:sqlite';
import { migrations } from './migrations';

export interface MigrationRecord {
  id: string;
  hash: string;
  created_at: number;
}

export class DatabaseMigrator {
  constructor(private sqlite: Database) {}

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<void> {
    // Create migrations table if it doesn't exist
    await this.ensureMigrationsTable();

    // Get applied migrations
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedIds = new Set(appliedMigrations.map(m => m.id));

    // Run pending migrations
    for (const migration of migrations) {
      if (!appliedIds.has(migration.id)) {
        console.log(`Running migration: ${migration.id}`);
        await this.runMigration(migration);
      }
    }

    console.log('All migrations completed successfully');
  }

  /**
   * Create the migrations tracking table
   */
  private async ensureMigrationsTable(): Promise<void> {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id TEXT PRIMARY KEY NOT NULL,
        hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  }

  /**
   * Get list of applied migrations
   */
  private async getAppliedMigrations(): Promise<MigrationRecord[]> {
    try {
      const rows = this.sqlite.query(`
        SELECT id, hash, created_at 
        FROM __drizzle_migrations 
        ORDER BY created_at ASC
      `).all() as MigrationRecord[];
      
      return rows;
    } catch (error) {
      // Table might not exist yet
      return [];
    }
  }

  /**
   * Run a single migration
   */
  private async runMigration(migration: typeof migrations[number]): Promise<void> {
    // Split SQL by statement breakpoints
    const statements = migration.sql
      .split('--> statement-breakpoint')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        this.sqlite.exec(statement);
      }
    }

    // Record migration as applied
    const hash = await this.hashString(migration.sql);
    this.sqlite.exec(`
      INSERT INTO __drizzle_migrations (id, hash, created_at) 
      VALUES (?, ?, ?)
    `, [migration.id, hash, Date.now()]);
  }

  /**
   * Simple hash function for migration content
   */
  private async hashString(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Check if database needs migration
   */
  async needsMigration(): Promise<boolean> {
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedIds = new Set(appliedMigrations.map(m => m.id));
    
    return migrations.some(migration => !appliedIds.has(migration.id));
  }
}