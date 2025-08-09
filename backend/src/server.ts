import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Fastify from 'fastify';
import { app } from './app';
import { config } from './config';
import { logger } from './utils/logger';

// Create Fastify instance with TypeBox
const server = Fastify({
  logger,
  ajv: {
    customOptions: {
      removeAdditional: 'all' as const,
      coerceTypes: true,
      useDefaults: true,
    },
  },
  trustProxy: true,
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'reqId',
  disableRequestLogging: false,
  bodyLimit: 10485760, // 10MB
}).withTypeProvider<TypeBoxTypeProvider>();

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
  server.log.fatal({ reason, promise }, 'Unhandled Rejection');
  process.exit(1);
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
