#!/usr/bin/env bun

import { startServer, makeConfigFromEnv } from './server.js';

// Handle internal server mode
if (process.argv.includes('--internal-run-server')) {
  // Run as daemon child process (no CLI)
  await startServer(makeConfigFromEnv());
  // Server keeps the process alive naturally - no need to exit
} else {
  // Normal CLI mode
  const { program } = await import('commander');
  const { serve } = await import('./commands/serve.js');
  const { status } = await import('./commands/status.js');
  const { stop } = await import('./commands/stop.js');
  const { logs } = await import('./commands/logs.js');
  const { config } = await import('./commands/config.js');

  const pkg = {
    version: process.env.npm_package_version || '0.1.0',
    name: 'pokecode'
  };

  program
    .name('pokecode')
    .description('PokéCode CLI - Local development server for Claude Code')
    .version(pkg.version);

  program
    .command('serve')
    .description('Start the PokéCode server')
    .option('-p, --port <port>', 'Server port', '3001')
    .option('-h, --host <host>', 'Server host', '0.0.0.0')
    .option('-d, --daemon', 'Run as daemon in background')
    .option('--data-dir <dir>', 'Data directory path')
    .option('--log-level <level>', 'Log level (trace, debug, info, warn, error)', 'info')
    .option('--no-cors', 'Disable CORS')
    .option('--no-helmet', 'Disable Helmet security headers')
    .action(serve);

  program
    .command('status')
    .description('Check server status')
    .option('-p, --port <port>', 'Server port to check', '3001')
    .option('-h, --host <host>', 'Server host to check', 'localhost')
    .action(status);

  program
    .command('stop')
    .description('Stop the daemon server')
    .option('--force', 'Force stop the server')
    .action(stop);

  program
    .command('logs')
    .description('Show server logs')
    .option('-f, --follow', 'Follow log output')
    .option('-n, --lines <number>', 'Number of lines to show', '50')
    .action(logs);

  program
    .command('config')
    .description('Manage configuration')
    .option('--init', 'Initialize configuration file')
    .option('--show', 'Show current configuration')
    .option('--edit', 'Edit configuration file')
    .action(config);

  // Error handling
  program.exitOverride();

  try {
    program.parse();
  } catch (error) {
    if (error instanceof Error) {
      console.error('CLI Error:', error.message);
      process.exit(1);
    }
  }
}