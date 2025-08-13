#!/usr/bin/env bun

import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { drizzle as drizzleSqlite } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { createId } from '@paralleldrive/cuid2';

// Import schemas
import * as pgSchema from '@/db/schema';
import * as sqliteSchema from '@/db/schema-sqlite';
import { config } from '@/config';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

console.log('🚀 Starting PostgreSQL to SQLite migration...');

// Setup PostgreSQL connection
const pgSql = postgres({
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  username: config.DB_USER,
  password: config.DB_PASSWORD,
});

const pgDb = drizzlePg(pgSql, { schema: pgSchema });

// Setup SQLite connection
const dbPath = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'pokecode.db');
mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
const sqliteDb = drizzleSqlite(sqlite, { schema: sqliteSchema });

// Configure SQLite for optimal performance during migration
sqlite.exec('PRAGMA journal_mode = MEMORY;'); // Faster writes during migration
sqlite.exec('PRAGMA synchronous = OFF;'); // Faster writes (less safe, but OK for migration)
sqlite.exec('PRAGMA cache_size = 1000000000;'); // 1GB cache
sqlite.exec('PRAGMA foreign_keys = OFF;'); // Disable FK checks during migration

async function runMigration() {
  try {
    console.log('📋 Running SQLite migrations...');
    await migrate(sqliteDb, { migrationsFolder: './drizzle-sqlite' });
    console.log('✅ SQLite migrations completed');

    console.log('📊 Fetching PostgreSQL data...');
    
    // Get all sessions
    const sessions = await pgDb.query.sessions.findMany({
      orderBy: (sessions, { asc }) => [asc(sessions.createdAt)],
    });
    console.log(`Found ${sessions.length} sessions`);

    // Get all session messages
    const sessionMessages = await pgDb.query.sessionMessages.findMany({
      orderBy: (messages, { asc }) => [asc(messages.createdAt)],
    });
    console.log(`Found ${sessionMessages.length} session messages`);

    // Get all file access records
    const fileAccess = await pgDb.query.fileAccess.findMany({
      orderBy: (files, { asc }) => [asc(files.createdAt)],
    });
    console.log(`Found ${fileAccess.length} file access records`);

    console.log('📥 Migrating data to SQLite...');

    // Migrate sessions
    if (sessions.length > 0) {
      console.log('  → Migrating sessions...');
      const sqliteSessions = sessions.map(session => ({
        ...session,
        // Convert UUID to CUID format if needed, or keep as-is since it's stored as text
        metadata: session.metadata ? JSON.stringify(session.metadata) : null,
      }));
      
      await sqliteDb.insert(sqliteSchema.sessions).values(sqliteSessions);
      console.log(`  ✅ Migrated ${sessions.length} sessions`);
    }

    // Migrate session messages
    if (sessionMessages.length > 0) {
      console.log('  → Migrating session messages...');
      const sqliteMessages = sessionMessages.map(message => ({
        ...message,
        type: message.type as 'user' | 'assistant', // Ensure proper typing
      }));
      
      await sqliteDb.insert(sqliteSchema.sessionMessages).values(sqliteMessages);
      console.log(`  ✅ Migrated ${sessionMessages.length} session messages`);
    }

    // Migrate file access records
    if (fileAccess.length > 0) {
      console.log('  → Migrating file access records...');
      const sqliteFileAccess = fileAccess.map(file => ({
        ...file,
        accessType: file.accessType as 'read' | 'write' | 'create' | 'delete',
        metadata: file.metadata ? JSON.stringify(file.metadata) : null,
      }));
      
      await sqliteDb.insert(sqliteSchema.fileAccess).values(sqliteFileAccess);
      console.log(`  ✅ Migrated ${fileAccess.length} file access records`);
    }

    console.log('🔧 Optimizing SQLite database...');
    
    // Re-enable foreign keys and optimize
    sqlite.exec('PRAGMA foreign_keys = ON;');
    sqlite.exec('PRAGMA journal_mode = WAL;');
    sqlite.exec('PRAGMA synchronous = NORMAL;');
    sqlite.exec('ANALYZE;'); // Update table statistics
    
    console.log('✅ Migration completed successfully!');
    console.log(`📁 SQLite database created at: ${dbPath}`);
    
    // Display summary
    console.log('\n📈 Migration Summary:');
    console.log(`  Sessions: ${sessions.length}`);
    console.log(`  Messages: ${sessionMessages.length}`);
    console.log(`  File Access: ${fileAccess.length}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close connections
    await pgSql.end();
    sqlite.close();
  }
}

// Run migration if this script is executed directly
if (import.meta.main) {
  runMigration();
}