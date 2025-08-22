import { getConfig } from '@pokecode/core';
import { createServer } from '@pokecode/server';

export async function startServer(): Promise<void> {
  const config = await getConfig();
  const server = await createServer();

  const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'] as const;
  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      try {
        await server.close();
        console.log('Server closed successfully');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    });
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    console.error('Reason details:', JSON.stringify(reason, null, 2));
    process.exit(1);
  });

  process.on('exit', (code) => {
    console.log('Process exiting with code:', code);
  });

  await server.listen({ port: config.port, host: config.host });

  console.log(`🚀 PokéCode server running at http://${config.host}:${config.port}`);
  console.log(`📁 Data directory: ${config.dataDir}`);
  console.log(`📊 Log level: ${config.logLevel}`);
  console.log(`🔍 Claude Code path: ${config.claudeCodePath}`);

  // Server is now listening and should naturally keep the process alive
  // The Fastify server handles should prevent the event loop from exiting
}
