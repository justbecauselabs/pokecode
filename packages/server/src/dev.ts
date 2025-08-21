#!/usr/bin/env bun

/**
 * Development server entry point
 */

// Set required environment variables for development  
process.env.NODE_ENV = 'development';

import { createServer } from './src/index.js';

const config = {
  port: 3004,
  host: '0.0.0.0',
  dataDir: './dev-data',
  logLevel: 'debug',
  cors: true,
  helmet: false, // Disable for easier development
  NODE_ENV: 'development'
};

console.log('🚀 Starting PokéCode development server...');
console.log('📁 Data directory:', config.dataDir);
console.log('🌐 Server will be available at: http://localhost:3004');

const server = await createServer(config);

// Graceful shutdown
const signals = ['SIGTERM', 'SIGINT'] as const;
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`\n📡 Received ${signal}, shutting down gracefully...`);
    try {
      await server.close();
      console.log('✅ Server closed successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  });
});

try {
  await server.listen({ port: config.port, host: config.host });
  console.log('\n✅ Development server started successfully!');
  console.log('📋 Available endpoints:');
  console.log('   • http://localhost:3004/ (API info)');
  console.log('   • http://localhost:3004/health (Health check)');
  console.log('   • http://localhost:3004/api/claude-code/sessions (Sessions API)');
  console.log('   • http://localhost:3004/api/claude-code/repositories (Repositories API)');
  console.log('\n💡 Press Ctrl+C to stop the server');
} catch (error) {
  console.error('❌ Failed to start development server:', error);
  process.exit(1);
}