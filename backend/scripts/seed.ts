#!/usr/bin/env bun

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { users } from '../src/db/schema';
import { config } from '../src/config';

async function seed() {
  console.log('🌱 Seeding database...');

  const connectionString = `postgresql://${config.DB_USER}:${config.DB_PASSWORD}@${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}`;
  const sql = postgres(connectionString);
  const db = drizzle(sql);

  try {
    // Create test user
    const hashedPassword = await bcrypt.hash('testpassword123', 10);
    
    await db.insert(users).values({
      id: crypto.randomUUID(),
      email: 'test@example.com',
      passwordHash: hashedPassword,
      name: 'Test User',
    }).onConflictDoNothing();

    console.log('✅ Test user created: test@example.com / testpassword123');
    
    await sql.end();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    await sql.end();
    process.exit(1);
  }
}

seed().catch(console.error);