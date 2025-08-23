import { checkDatabaseHealth, getConfig } from '@pokecode/core';
import Fastify, { type FastifyPluginAsync } from 'fastify';
import { FastifySSEPlugin } from 'fastify-sse-v2';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import directoryRoutes from './directories';
// Import routes
import healthRoutes from './health';
// Import plugins
import errorHandlerPlugin from './plugins/error-handler';
import requestLoggerPlugin from './plugins/request-logger';
import repositoryRoutes from './repositories';
import sessionRoutes from './sessions';
import type { ClaudeCodeSQLiteWorker } from './workers';

// Export worker class for external usage
export { ClaudeCodeSQLiteWorker } from './workers';

// Global worker instance
let globalWorker: ClaudeCodeSQLiteWorker | null = null;

export const createApp: FastifyPluginAsync = async (fastify) => {
  // Set up Zod type provider
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  // Register SSE plugin
  await fastify.register(FastifySSEPlugin, {
    retryDelay: 3000,
    highWaterMark: 16384,
  });

  // Register plugins in order
  await fastify.register(errorHandlerPlugin);

  await fastify.register(requestLoggerPlugin);

  // Register routes
  await fastify.register(healthRoutes, { prefix: '/health' });
  await fastify.register(repositoryRoutes, { prefix: '/api/claude-code/repositories' });
  await fastify.register(directoryRoutes, { prefix: '/api/claude-code/directories' });
  await fastify.register(sessionRoutes, { prefix: '/api/claude-code/sessions' });

  // Health check database connection (worker started separately by CLI)
  fastify.addHook('onReady', async () => {
    const isHealthy = await checkDatabaseHealth();
    if (isHealthy) {
      fastify.log.info('Database connection verified');
    } else {
      fastify.log.error('Database health check failed');
      throw new Error('Database initialization failed');
    }
  });

  // Close worker on shutdown
  fastify.addHook('onClose', async () => {
    if (globalWorker) {
      await globalWorker.shutdown();
      globalWorker = null;
      fastify.log.info('Worker stopped');
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
  fastify.ready(() => {
    fastify.log.info('\nRegistered routes:');
    fastify.log.info(fastify.printRoutes({ commonPrefix: false }));
  });
};

// Export worker for access in routes
export const getWorker = () => globalWorker;

// Set the global worker instance
export const setWorker = (worker: ClaudeCodeSQLiteWorker | null) => {
  globalWorker = worker;
};

export async function createServer() {
  const config = await getConfig();
  const fastify = Fastify({
    logger: {
      level: config.logLevel,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  }).withTypeProvider<ZodTypeProvider>();

  await fastify.register(createApp);
  return fastify;
}
