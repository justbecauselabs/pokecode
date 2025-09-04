import { getConfig, initDatabase } from '@pokecode/core';
import { AgentRunnerWorker, createServer, setWorker } from '@pokecode/server';

// Store worker reference at module level for cleanup
let worker: AgentRunnerWorker | null = null;

export async function startServer(): Promise<void> {
  const config = await getConfig();
  // Ensure database is initialized and migrations are applied before server startup
  await initDatabase({ runMigrations: true });
  const server = await createServer();

  // Signal handling for graceful shutdown
  const handleShutdown = async (signal: string): Promise<void> => {
    console.log(`\n🚨 Received ${signal}, shutting down gracefully...`);

    // Set up timeout fallback to prevent hanging
    const forceExitTimeout = setTimeout(() => {
      console.warn('⏰ Forced exit after 10 seconds timeout');
      process.exit(1);
    }, 10000);

    try {
      // Shutdown worker FIRST before server
      if (worker) {
        console.log('🔄 Shutting down worker...');
        await worker.shutdown();
        console.log('✅ Worker shutdown complete');
      }

      // Then close server
      console.log('🔄 Closing server...');
      await server.close();
      console.log('✅ Server closed successfully');

      // Clear timeout since we completed gracefully
      clearTimeout(forceExitTimeout);
      console.log('🎉 Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during graceful shutdown:', error);
      clearTimeout(forceExitTimeout);
      process.exit(1);
    }
  };

  const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'] as const;
  signals.forEach((signal) => {
    process.on(signal, () => {
      // Don't await here to avoid potential issues with signal handlers
      handleShutdown(signal).catch((error) => {
        console.error(`❌ Error in ${signal} handler:`, error);
        process.exit(1);
      });
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught exception:', error);
    console.error('📍 Stack trace:', error.stack);

    // Try to cleanup worker synchronously to avoid further issues
    if (worker) {
      worker.shutdown().catch(() => {
        // Ignore cleanup errors during crash
      });
    }
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
    if (reason instanceof Error) {
      console.error('📍 Stack trace:', reason.stack);
    }

    // Try to cleanup worker synchronously to avoid further issues
    if (worker) {
      worker.shutdown().catch(() => {
        // Ignore cleanup errors during crash
      });
    }
    process.exit(1);
  });

  process.on('exit', (code) => {
    console.log('Process exiting with code:', code);
  });

  await server.listen({ port: config.port, host: config.host });

  console.log(`🚀 PokéCode server running at http://${config.host}:${config.port}`);
  console.log(`📝 Logs: ${config.logFile}`);
  console.log(`📊 Log level: ${config.logLevel}`);
  console.log(`🔍 Claude Code path: ${config.claudeCodePath}`);

  // Start worker after server is listening
  console.log('🔍 Starting worker after server startup...');
  try {
    worker = new AgentRunnerWorker();
    await worker.start();
    // Store the worker globally so server components can access it
    setWorker(worker);
    console.log('✅ Worker started successfully!');
  } catch (error) {
    console.error('❌ Failed to start worker:', error);
    process.exit(1);
  }

  // Server is now listening and should naturally keep the process alive
  // The Fastify server handles should prevent the event loop from exiting
}
