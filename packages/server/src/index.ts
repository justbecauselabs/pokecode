import { checkDatabaseHealth, getConfig } from '@pokecode/core';
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
import errorHandlerPlugin from './plugins/error-handler';
import requestLoggerPlugin from './plugins/request-logger';
import repositoryRoutes from './repositories';
import sessionRoutes from './sessions';
import { ClaudeCodeSQLiteWorker } from './workers';

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
  await fastify.register(sessionRoutes, { prefix: '/api/claude-code/sessions' });

  // Health check database connection and start worker
  fastify.addHook('onReady', async () => {
    const isHealthy = await checkDatabaseHealth();
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
