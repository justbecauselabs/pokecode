import helmet from '@fastify/helmet';
import Fastify, { type FastifyPluginAsync } from 'fastify';
import { FastifySSEPlugin } from 'fastify-sse-v2';
import { config } from '@/config';
// Rate limiting removed - was Redis-based
// Import plugins
import corsPlugin from './plugins/cors';
import errorHandlerPlugin from './plugins/error-handler';
import requestLoggerPlugin from './plugins/request-logger';
// Import routes
import healthRoutes from './routes/health';
import repositoryRoutes from './routes/repositories';
import sessionRoutes from './routes/sessions';
// Import worker
import { ClaudeCodeSQLiteWorker } from './workers/claude-code-sqlite.worker';

// Global worker instance to share across the app
let globalWorker: ClaudeCodeSQLiteWorker | null = null;

export const app: FastifyPluginAsync = async (fastify, _opts) => {
  // Register SSE plugin
  await fastify.register(FastifySSEPlugin, {
    retryDelay: 3000,
    highWaterMark: 16384,
  });

  // Register security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  // Register plugins in order
  await fastify.register(errorHandlerPlugin);
  await fastify.register(corsPlugin);
  await fastify.register(requestLoggerPlugin);
  // Rate limiting plugin removed (was Redis-based)

  // Register routes
  await fastify.register(healthRoutes, { prefix: '/health' });
  await fastify.register(repositoryRoutes, { prefix: '/api/claude-code/repositories' });
  await fastify.register(sessionRoutes, { prefix: '/api/claude-code/sessions' });

  // Start the worker when the app is ready
  fastify.addHook('onReady', async () => {
    if (!globalWorker) {
      fastify.log.info('Starting embedded Claude Code worker...');
      globalWorker = new ClaudeCodeSQLiteWorker();
      await globalWorker.start();
      fastify.log.info('Claude Code worker started successfully');
    }
  });

  // Stop the worker when the app is closing
  fastify.addHook('onClose', async () => {
    if (globalWorker) {
      fastify.log.info('Stopping embedded Claude Code worker...');
      await globalWorker.shutdown();
      globalWorker = null;
      fastify.log.info('Claude Code worker stopped');
    }
  });

  // Root route
  fastify.get('/', async (_request, _reply) => {
    return {
      name: 'Claude Code Mobile API',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
    };
  });

  // Log registered routes in development
  if (config.NODE_ENV === 'development') {
    fastify.ready(() => {
      fastify.log.info('\nRegistered routes:');
      fastify.log.info(fastify.printRoutes({ commonPrefix: false }));
    });
  }
};

// Export worker instance for access in routes
export { globalWorker };

export async function build(opts = {}) {
  const fastify = Fastify(opts);
  await fastify.register(app);
  return fastify;
}
