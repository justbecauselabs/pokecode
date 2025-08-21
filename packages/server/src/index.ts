import { join } from 'node:path';
import helmet from '@fastify/helmet';
import { DatabaseManager, getConfig } from '@pokecode/core';
import Fastify, { type FastifyPluginAsync } from 'fastify';
import { FastifySSEPlugin } from 'fastify-sse-v2';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
// Import routes
import healthRoutes from './health';
// Import plugins
import corsPlugin from './plugins/cors';
import errorHandlerPlugin from './plugins/error-handler';
import requestLoggerPlugin from './plugins/request-logger';
import repositoryRoutes from './repositories';
import sessionRoutes from './sessions';
import { ClaudeCodeSQLiteWorker } from './workers';

export interface ServerConfig {
  port: number;
  host: string;
  dataDir?: string; // Optional - database now defaults to ~/.pokecode/
  logLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  cors: boolean;
  helmet: boolean;
  NODE_ENV?: string;
}

// Global instances to share across the app
let globalDb: DatabaseManager | null = null;
let globalWorker: ClaudeCodeSQLiteWorker | null = null;

export const createApp: FastifyPluginAsync<{
  dataDir?: string;
  cors: boolean;
  helmet: boolean;
  NODE_ENV?: string;
}> = async (fastify, opts) => {
  // Initialize database
  if (!globalDb) {
    const dbPath = opts.dataDir ? join(opts.dataDir, 'pokecode.db') : undefined;
    globalDb = new DatabaseManager({
      isTest: opts.NODE_ENV === 'test',
      enableWAL: true,
      ...(dbPath && { dbPath }),
    });

    // Ensure tables exist
    try {
      await globalDb.ensureTablesExist();
    } catch (error) {
      fastify.log.error({ error }, 'Failed to ensure database tables exist');
      throw new Error('Database initialization failed');
    }
  }

  // Set up Zod type provider
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  // Register SSE plugin
  await fastify.register(FastifySSEPlugin, {
    retryDelay: 3000,
    highWaterMark: 16384,
  });

  // Register security headers if enabled
  if (opts.helmet) {
    await fastify.register(helmet, {
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    });
  }

  // Register plugins in order
  await fastify.register(errorHandlerPlugin);

  if (opts.cors) {
    await fastify.register(corsPlugin);
  }

  await fastify.register(requestLoggerPlugin);

  // Register routes
  await fastify.register(healthRoutes, { prefix: '/health' });
  await fastify.register(repositoryRoutes, { prefix: '/api/claude-code/repositories' });
  await fastify.register(sessionRoutes, { prefix: '/api/claude-code/sessions' });

  // Health check database connection and start worker
  fastify.addHook('onReady', async () => {
    if (globalDb) {
      const isHealthy = await globalDb.checkHealth();
      if (isHealthy) {
        fastify.log.info('Database connection verified');

        // Start the worker after database is ready
        if (!globalWorker) {
          globalWorker = new ClaudeCodeSQLiteWorker();
          await globalWorker.start();
          fastify.log.info('Worker started successfully');
        }
      } else {
        fastify.log.error('Database health check failed');
        throw new Error('Database initialization failed');
      }
    }
  });

  // Close database and worker on shutdown
  fastify.addHook('onClose', async () => {
    // Stop worker first
    if (globalWorker) {
      await globalWorker.shutdown();
      globalWorker = null;
      fastify.log.info('Worker stopped');
    }

    // Then close database
    if (globalDb) {
      globalDb.close();
      globalDb = null;
      fastify.log.info('Database connection closed');
    }
  });

  // Root route
  fastify.get('/', async (_request, _reply) => {
    return {
      name: 'PokéCode API Server',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
    };
  });

  // Log registered routes in development
  if (opts.NODE_ENV === 'development') {
    fastify.ready(() => {
      fastify.log.info('\nRegistered routes:');
      fastify.log.info(fastify.printRoutes({ commonPrefix: false }));
    });
  }
};

// Export instances for access in routes
export const getDatabase = () => globalDb;
export const getWorker = () => globalWorker;

export async function createServer(config: ServerConfig) {
  const _envConfig = await getConfig();
  const fastify = Fastify({
    logger: {
      level: config.logLevel || 'info',
      ...(config.NODE_ENV === 'development' && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      }),
    },
  }).withTypeProvider<ZodTypeProvider>();

  await fastify.register(createApp, {
    ...(config.dataDir && { dataDir: config.dataDir }),
    cors: config.cors,
    helmet: config.helmet,
    ...(config.NODE_ENV && { NODE_ENV: config.NODE_ENV }),
  });
  return fastify;
}
