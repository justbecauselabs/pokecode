import { getConfig, initDatabase } from '@pokecode/core';
import { AgentRunnerWorker, createServer, getWorker, setWorker } from './index';

async function start(): Promise<void> {
  const config = await getConfig();

  // Ensure DB is ready (apply migrations) before starting server
  await initDatabase({ runMigrations: true });

  const fastify = await createServer();

  const shutdown = async (signal: string) => {
    try {
      fastify.log.info({ signal }, 'Shutting down...');
      // Stop worker first if present
      const worker = getWorker();
      if (worker) {
        await worker.shutdown();
        setWorker(null);
      }
      await fastify.close();
      process.exit(0);
    } catch (err) {
      fastify.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  ['SIGINT', 'SIGTERM', 'SIGUSR2'].forEach((sig) => {
    process.on(sig as NodeJS.Signals, () => {
      void shutdown(sig);
    });
  });

  await fastify.listen({ host: config.host, port: config.port });
  fastify.log.info(`Server listening at http://${config.host}:${config.port}`);

  // Start worker
  try {
    const worker = new AgentRunnerWorker();
    await worker.start();
    setWorker(worker);
    fastify.log.info('Worker started');
  } catch (err) {
    fastify.log.error({ err }, 'Failed to start worker');
    process.exit(1);
  }
}

if (import.meta.main) {
  start().catch((err) => {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  });
}

export default start;
