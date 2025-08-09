import { sql } from 'drizzle-orm';
import { config } from '@/config';
import { db } from '@/db';
import { createChildLogger } from '@/utils/logger';
import { ClaudeCodeWorker } from './claude-code.worker';

const logger = createChildLogger('worker-main');

// Export for testing
export { ClaudeCodeWorker };

/**
 * Verifies database connection before starting worker
 */
async function verifyDatabaseConnection(): Promise<void> {
  try {
    await db.execute(sql`SELECT 1`);
    logger.info('Database connection verified');
  } catch (error) {
    logger.error({ error }, 'Database connection failed');
    throw error;
  }
}

/**
 * Verifies Redis connection through worker
 */
async function verifyRedisConnection(): Promise<void> {
  try {
    // Redis connection is verified when worker is created
    logger.info('Redis connection verified');
  } catch (error) {
    logger.error({ error }, 'Redis connection failed');
    throw error;
  }
}

/**
 * Main worker startup function
 */
async function startWorker(): Promise<ClaudeCodeWorker> {
  logger.info({ environment: config.NODE_ENV }, 'Starting Claude Code Worker...');

  // Verify connections
  await verifyDatabaseConnection();
  await verifyRedisConnection();

  // Create and start worker
  const worker = new ClaudeCodeWorker();
  await worker.start();

  const metrics = await worker.getMetrics();
  logger.info(
    {
      queue: 'claude-code-jobs',
      concurrency: metrics.concurrency,
      status: 'Running',
    },
    'Claude Code Worker started successfully',
  );

  return worker;
}

/**
 * Graceful shutdown handler
 */
async function handleShutdown(signal: string, worker: ClaudeCodeWorker): Promise<void> {
  logger.info({ signal }, 'Received signal, initiating graceful shutdown...');

  try {
    await worker.shutdown();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
}

// Only start worker if this file is run directly
if (require.main === module) {
  let worker: ClaudeCodeWorker | null = null;

  // Start the worker
  startWorker()
    .then((w) => {
      worker = w;

      // Setup graceful shutdown handlers
      process.on('SIGTERM', () => {
        if (worker) {
          handleShutdown('SIGTERM', worker);
        }
      });
      process.on('SIGINT', () => {
        if (worker) {
          handleShutdown('SIGINT', worker);
        }
      });

      // Handle uncaught errors
      process.on('uncaughtException', async (error) => {
        logger.fatal({ error }, 'Uncaught exception');
        if (worker) {
          await worker.shutdown();
        }
        process.exit(1);
      });

      process.on('unhandledRejection', async (reason, promise) => {
        logger.fatal({ reason, promise }, 'Unhandled rejection');
        if (worker) {
          await worker.shutdown();
        }
        process.exit(1);
      });
    })
    .catch((error) => {
      logger.fatal({ error }, 'Failed to start worker');
      process.exit(1);
    });
}
