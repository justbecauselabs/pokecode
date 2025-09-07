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
import type { AgentRunnerWorker } from './workers';

// Export worker class for external usage
export { AgentRunnerWorker } from './workers';

// Global worker instance
let globalWorker: AgentRunnerWorker | null = null;

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
  await fastify.register(repositoryRoutes, { prefix: '/api/repositories' });
  await fastify.register(directoryRoutes, { prefix: '/api/directories' });
  await fastify.register(sessionRoutes, { prefix: '/api/sessions' });
  await fastify.register(import('./connect'), { prefix: '/api/connect' });

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
export const setWorker = (worker: AgentRunnerWorker | null) => {
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
      // We emit request logs ourselves (with sanitized bodies)
      // to avoid duplicate lines and to include parsed body safely.
    },
    // Disable Fastify's built-in request logging so we can replace it
    // with our sanitized version in the request-logger plugin.
    disableRequestLogging: true,
  }).withTypeProvider<ZodTypeProvider>();

  await fastify.register(createApp);
  return fastify;
}
