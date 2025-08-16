import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { app } from './app';
import { config } from './config';
import { logger } from './utils/logger';

// Create Fastify instance with Zod
const server = Fastify({
  logger,
  trustProxy: true,
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'reqId',
  disableRequestLogging: false,
  bodyLimit: 10485760, // 10MB
}).withTypeProvider<ZodTypeProvider>();

// Set up Zod validator and serializer
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

// Register application
server.register(app);

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    server.log.info(`Received ${signal}, shutting down gracefully...`);

    try {
      await server.close();
      server.log.info('Server closed successfully');
      process.exit(0);
    } catch (err) {
      server.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  });
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  server.log.fatal(error, 'Uncaught Exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  // Log the error but don't exit the process to maintain server availability
  // Worker failures should not bring down the entire server
  server.log.error({ reason, promise }, 'Unhandled Rejection - continuing server operation');

  // Only exit if this is a critical server error, not a worker error
  if (reason instanceof Error && reason.message.includes('EADDRINUSE')) {
    server.log.fatal({ reason, promise }, 'Critical server error - shutting down');
    process.exit(1);
  }
});

// Start server
const start = async () => {
  try {
    await server.listen({
      port: config.PORT,
      host: '0.0.0.0',
    });

    const address = server.server.address();
    const port = typeof address === 'string' ? address : address?.port;

    server.log.info(`
🚀 Claude Code Mobile API Server Started
📍 Environment: ${config.NODE_ENV}
🌐 Server: http://0.0.0.0:${port}
📚 API Docs: http://0.0.0.0:${port}/docs
🏥 Health: http://0.0.0.0:${port}/health
    `);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Start the server
start();
