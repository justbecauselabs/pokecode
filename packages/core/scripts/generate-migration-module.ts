#!/usr/bin/env bun

/**
 * Script to generate TypeScript migration module from SQL files
 * Run this after `bun run db:generate` to update the bundled migrations
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createChildLogger } from '../src/utils/logger.js';

const logger = createChildLogger('migration-generator');

async function generateMigrationModule() {
  const migrationsDir = join(process.cwd(), 'src/database/migrations');
  const outputFile = join(migrationsDir, 'index.ts');

  try {
    // Read all SQL files
    const files = await readdir(migrationsDir);
    const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort(); // Sort to maintain order

    logger.info(`Found ${sqlFiles.length} migration files`);

    const migrations = [];

    for (const file of sqlFiles) {
      const filePath = join(migrationsDir, file);
      const sql = await readFile(filePath, 'utf-8');
      const id = file.replace('.sql', '');

      migrations.push({
        id,
        sql: sql.trim(),
      });

      logger.info(`  - ${id}`);
    }

    // Generate TypeScript module
    const moduleContent = `// Auto-generated bundled migrations for PokéCode
// This file is automatically updated when migrations are generated
// DO NOT EDIT MANUALLY - Run 'bun run generate-migration-module' instead

export const migrations = [
${migrations
  .map(
    (m) => `  {
    id: '${m.id}',
    sql: \`${m.sql.replace(/`/g, '\\`')}\`
  }`,
  )
  .join(',\n')}
] as const;

export type Migration = typeof migrations[number];
`;

    await writeFile(outputFile, moduleContent);
    logger.info(`✅ Generated migration module: ${outputFile}`);
  } catch (error) {
    logger.error('❌ Failed to generate migration module:', error);
    process.exit(1);
  }
}

generateMigrationModule();
