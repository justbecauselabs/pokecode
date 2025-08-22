import type { Database } from 'bun:sqlite';
import { createChildLogger } from '../utils/logger';
import { migrations } from './migrations';

export interface MigrationRecord {
  id: string;
  hash: string;
  created_at: number;
}

export class DatabaseMigrator {
  private logger = createChildLogger('database-migrator');

  constructor(private sqlite: Database) {}

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<void> {
    this.logger.info('🔄 Starting database migration process...');

    // Create migrations table if it doesn't exist
    this.logger.info('📋 Ensuring migrations tracking table exists...');
    await this.ensureMigrationsTable();

    // Get applied migrations
    this.logger.info('📊 Checking for previously applied migrations...');
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedIds = new Set(appliedMigrations.map((m) => m.id));

    this.logger.info(`📈 Found ${appliedMigrations.length} previously applied migrations:`);
    appliedMigrations.forEach((migration) => {
      this.logger.info(
        `  ✅ ${migration.id} (applied: ${new Date(migration.created_at).toISOString()})`,
      );
    });

    this.logger.info(`🔍 Available migrations: ${migrations.length}`);
    const pendingMigrations = migrations.filter((migration) => !appliedIds.has(migration.id));

    if (pendingMigrations.length === 0) {
      this.logger.info('✨ No pending migrations to run. Database is up to date!');
      return;
    }

    this.logger.info(`⏳ Found ${pendingMigrations.length} pending migrations to run:`);
    pendingMigrations.forEach((migration) => {
      this.logger.info(`  🔸 ${migration.id}`);
    });

    // Run pending migrations
    for (const migration of pendingMigrations) {
      await this.runMigration(migration);
    }

    this.logger.info('✅ All migrations completed successfully!');
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
      const rows = this.sqlite
        .query(`
        SELECT id, hash, created_at 
        FROM __drizzle_migrations 
        ORDER BY created_at ASC
      `)
        .all();

      return rows as MigrationRecord[];
    } catch (_error) {
      // Table might not exist yet - this is expected on first run
      this.logger.info('No existing migration tracking table found (this is normal for first run)');
      return [];
    }
  }

  /**
   * Run a single migration
   */
  private async runMigration(migration: (typeof migrations)[number]): Promise<void> {
    // Validate migration object
    if (!migration?.id || !migration?.sql) {
      throw new Error('Invalid migration object: missing id or sql');
    }

    this.logger.info(`🚀 Running migration: ${migration.id}`);
    const startTime = Date.now();

    // Split SQL by statement breakpoints
    const statements = migration.sql
      .split('--> statement-breakpoint')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    if (statements.length === 0) {
      this.logger.info(`  ⚠️ Migration ${migration.id} contains no executable statements`);
      return;
    }

    this.logger.info(`  📝 Executing ${statements.length} SQL statement(s)...`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement?.trim()) {
        try {
          const firstLine = statement.split('\n')[0];
          if (firstLine) {
            this.logger.info(
              `    [${i + 1}/${statements.length}] ${firstLine.substring(0, 50)}...`,
            );
          }
          this.sqlite.exec(statement);
          this.logger.info(`    ✅ Statement ${i + 1} executed successfully`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error(`    ❌ Statement ${i + 1} failed: ${errorMessage}`, error);
          throw new Error(
            `Migration ${migration.id} failed at statement ${i + 1}: ${errorMessage}`,
          );
        }
      }
    }

    // Record migration as applied
    this.logger.info(`  💾 Recording migration as applied...`);
    const hash = await this.hashString(migration.sql);
    try {
      this.sqlite.exec(
        `
        INSERT INTO __drizzle_migrations (id, hash, created_at) 
        VALUES (?, ?, ?)
      `,
        [migration.id, hash, Date.now()],
      );

      const duration = Date.now() - startTime;
      this.logger.info(`  ✅ Migration ${migration.id} completed in ${duration}ms`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`  ❌ Failed to record migration: ${errorMessage}`, error);
      throw new Error(`Failed to record migration ${migration.id} as applied: ${errorMessage}`);
    }
  }

  /**
   * Simple hash function for migration content
   */
  private async hashString(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Check if database needs migration
   */
  async needsMigration(): Promise<boolean> {
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedIds = new Set(appliedMigrations.map((m) => m.id));

    return migrations.some((migration) => !appliedIds.has(migration.id));
  }
}
