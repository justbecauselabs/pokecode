#!/usr/bin/env bun

/**
 * Development server entry point
 */

// Set required environment variables for development
process.env.NODE_ENV = 'development';

import { overrideConfig } from '@pokecode/core';
import { createServer } from './index';

// Override config for development
overrideConfig({
  port: 3001,
  host: '0.0.0.0',
  dataDir: './dev-data',
  logLevel: 'debug', // Disable for easier development
});

console.info('🚀 Starting PokéCode development server...');
console.info('📁 Data directory: ./dev-data');
console.info('🌐 Server will be available at: http://localhost:3004');

const server = await createServer();

// Graceful shutdown
const signals = ['SIGTERM', 'SIGINT'] as const;
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.info(`\n📡 Received ${signal}, shutting down gracefully...`);
    try {
      await server.close();
      console.info('✅ Server closed successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  });
});

try {
  await server.listen({ port: 3001, host: '0.0.0.0' });
  console.info('\n✅ Development server started successfully!');
  console.info('📋 Available endpoints:');
  console.info('   • http://localhost:3001/ (API info)');
  console.info('   • http://localhost:3001/health (Health check)');
  console.info('   • http://localhost:3001/api/claude-code/sessions (Sessions API)');
  console.info('   • http://localhost:3001/api/claude-code/repositories (Repositories API)');
  console.info('\n💡 Press Ctrl+C to stop the server');
} catch (error) {
  console.error('❌ Failed to start development server:', error);
  process.exit(1);
}
