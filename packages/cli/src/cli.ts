#!/usr/bin/env bun

import { startServer } from './server';

// Handle internal server mode
if (process.argv.includes('--internal-run-server')) {
  // Run as daemon child process (no CLI)
  await startServer();
  // Server keeps the process alive naturally - no need to exit
} else {
  // Normal CLI mode
  const { program } = await import('commander');
  const { serve } = await import('./commands/serve');
  const { status } = await import('./commands/status');
  const { stop } = await import('./commands/stop');
  const { logs } = await import('./commands/logs');
  const { setup } = await import('./commands/setup');

  const pkg = {
    version: process.env.npm_package_version || '0.1.0',
    name: 'pokecode',
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

  program.command('setup').description('Setup PokéCode with Claude Code path').action(setup);

  // Parse normally so --help and errors are handled by commander
  program.parse();
}
