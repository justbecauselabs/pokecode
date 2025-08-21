import { join } from 'node:path';
import { createServer } from '@pokecode/server';
import { DatabaseManager } from '@pokecode/core';

export interface ServerConfig {
  port: number;
  host: string;
  dataDir: string;
  logLevel: string;
  cors: boolean;
  helmet: boolean;
  NODE_ENV?: string;
}

export function makeConfigFromEnv(): ServerConfig {
  const home = process.env.HOME || process.env.USERPROFILE || '/tmp';
  const defaultData = join(home, '.pokecode', 'data');
  return {
    port: Number(process.env.POKECODE_PORT) || 3001,
    host: process.env.POKECODE_HOST || '0.0.0.0',
    dataDir: process.env.POKECODE_DATA_DIR || defaultData,
    logLevel: process.env.POKECODE_LOG_LEVEL || 'info',
    cors: process.env.POKECODE_CORS !== 'false',
    helmet: process.env.POKECODE_HELMET !== 'false',
    NODE_ENV: process.env.NODE_ENV || 'production',
  };
}

export async function startServer(config: ServerConfig): Promise<void> {
  // Ensure DB & tables exist
  const dbPath = join(config.dataDir, 'pokecode.db');
  const dbManager = new DatabaseManager({ dbPath, isTest: config.NODE_ENV === 'test', enableWAL: true });
  await dbManager.ensureTablesExist();

  const server = await createServer(config);

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

  // Server is now listening and should naturally keep the process alive
  // The Fastify server handles should prevent the event loop from exiting
}