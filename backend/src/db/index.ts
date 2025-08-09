import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '@/config';
import { createChildLogger } from '@/utils/logger';
import * as schema from './schema';

const logger = createChildLogger('database');

// Create optimized connection pool
const sql = postgres({
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  username: config.DB_USER,
  password: config.DB_PASSWORD,

  // Connection pool settings
  max: 20, // Maximum connections
  idle_timeout: 20, // Close idle connections after 20s
  connect_timeout: 10, // Connection timeout 10s

  // Performance settings
  prepare: true, // Use prepared statements
  types: {
    bigint: postgres.BigInt,
  },

  // SSL configuration for production
  ssl: config.NODE_ENV === 'production' ? 'require' : false,

  // Connection lifecycle hooks
  onnotice: (_notice) => {},
});

export const db = drizzle(sql, { schema });

// Export the underlying postgres instance for raw queries if needed
export { sql };

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return false;
  }
}
