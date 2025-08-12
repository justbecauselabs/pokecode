import helmet from '@fastify/helmet';
import Fastify, { type FastifyPluginAsync } from 'fastify';
import rateLimitPlugin from './hooks/rate-limit.hook';
// Import plugins
import corsPlugin from './plugins/cors';
import errorHandlerPlugin from './plugins/error-handler';
import requestLoggerPlugin from './plugins/request-logger';
import swaggerPlugin from './plugins/swagger';
// Import routes
import healthRoutes from './routes/health';
import repositoryRoutes from './routes/repositories';
import sessionRoutes from './routes/sessions';
import { historyAndExportRoutes } from './routes/sessions/prompts';

export const app: FastifyPluginAsync = async (fastify, _opts) => {
  // Register security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  // Register plugins in order
  await fastify.register(errorHandlerPlugin);
  await fastify.register(corsPlugin);
  await fastify.register(requestLoggerPlugin);
  await fastify.register(swaggerPlugin);
  await fastify.register(rateLimitPlugin);

  // Register routes
  await fastify.register(healthRoutes, { prefix: '/health' });
  await fastify.register(repositoryRoutes, { prefix: '/api/claude-code/repositories' });
  await fastify.register(sessionRoutes, { prefix: '/api/claude-code/sessions' });

  // Register history and export routes at session level
  await fastify.register(historyAndExportRoutes, {
    prefix: '/api/claude-code/sessions/:sessionId',
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
  if (process.env.NODE_ENV === 'development') {
    fastify.ready(() => {
      fastify.log.info('\nRegistered routes:');
      fastify.log.info(fastify.printRoutes({ commonPrefix: false }));
    });
  }
};

export async function build(opts = {}) {
  const fastify = Fastify(opts);
  await fastify.register(app);
  return fastify;
}
