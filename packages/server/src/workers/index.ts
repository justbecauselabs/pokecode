import { createChildLogger, db } from '@pokecode/core';
import { sql } from 'drizzle-orm';
import { ClaudeCodeSQLiteWorker } from './claude-code-sqlite.worker';

const logger = createChildLogger('worker-main');

// Interface for worker with cleanup interval
interface WorkerWithCleanup extends ClaudeCodeSQLiteWorker {
  cleanupInterval?: ReturnType<typeof setInterval>;
}

// Export for testing
export { ClaudeCodeSQLiteWorker };

/**
 * Verifies database connection and table existence before starting worker
 */
async function verifyDatabaseConnection(): Promise<void> {
  try {
    // Test basic connection
    db.run(sql`SELECT 1`);
    logger.info('Database connection verified');

    // Verify required tables exist
    const requiredTables = ['job_queue', 'claude_code_sessions', 'session_messages'];
    const existingTables = db.all(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name IN (${sql.join(requiredTables, sql`, `)})`,
    ) as { name: string }[];

    const existingTableNames = existingTables.map((t) => t.name);
    const missingTables = requiredTables.filter((table) => !existingTableNames.includes(table));

    if (missingTables.length > 0) {
      throw new Error(
        `Required database tables are missing: ${missingTables.join(', ')}. Run 'bun run db:push' to create them.`,
      );
    }

    logger.info({ tables: existingTableNames }, 'Required database tables verified');
  } catch (error) {
    logger.error({ error }, 'Database verification failed');
    throw error;
  }
}

/**
 * Main worker startup function
 */
async function startWorker(): Promise<ClaudeCodeSQLiteWorker> {
  logger.info({ environment: process.env.NODE_ENV }, 'Starting Claude Code SQLite Worker...');

  // Verify database connection
  await verifyDatabaseConnection();

  // Create and start worker
  const worker = new ClaudeCodeSQLiteWorker();
  await worker.start();

  const metrics = await worker.getMetrics();
  logger.info(
    {
      queue: 'sqlite-jobs',
      concurrency: metrics.concurrency,
      status: 'Running',
    },
    'Claude Code SQLite Worker started successfully',
  );

  // Setup cleanup job (run every hour)
  const cleanupInterval = setInterval(
    async () => {
      try {
        await worker.cleanup();
      } catch (error) {
        logger.error({ error }, 'Error during cleanup');
      }
    },
    60 * 60 * 1000,
  ); // 1 hour

  // Store cleanup interval on worker for shutdown
  (worker as WorkerWithCleanup).cleanupInterval = cleanupInterval;

  return worker;
}

/**
 * Graceful shutdown handler
 */
async function handleShutdown(signal: string, worker: ClaudeCodeSQLiteWorker): Promise<void> {
  logger.info({ signal }, 'Received signal, initiating graceful shutdown...');

  try {
    // Clear cleanup interval if it exists
    const cleanupInterval = (worker as WorkerWithCleanup).cleanupInterval;
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
    }

    await worker.shutdown();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
}

// Only start worker if this file is run directly
if (import.meta.main) {
  let worker: ClaudeCodeSQLiteWorker | null = null;

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
