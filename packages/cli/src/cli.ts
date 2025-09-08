#!/usr/bin/env bun
import { program } from 'commander';
import { logs } from './commands/logs';
import { serve } from './commands/serve';
import { setup } from './commands/setup';
import { startServer } from './server';

// Handle internal server mode
if (process.argv.includes('--internal-run-server')) {
  // Run as daemon child process (no CLI)
  await startServer();
  // Server keeps the process alive naturally - no need to exit
} else {
  // Normal CLI mode

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
    .option('--codex-cli <path>', 'Override Codex CLI path for this run')
    .option('--data-dir <dir>', 'Data directory path')
    .option('--log-level <level>', 'Log level (trace, debug, info, warn, error)', 'info')
    .option('--no-cors', 'Disable CORS')
    .option('--no-helmet', 'Disable Helmet security headers')
    .action(serve);

  // status/stop removed; server runs in foreground

  program
    .command('logs')
    .description('Show server logs')
    .option('-f, --follow', 'Follow log output')
    .option('-n, --lines <number>', 'Number of lines to show', '50')
    .action(logs);

  program.command('setup').description('Setup PokéCode with Claude Code path').action(setup);

  // Experimental OpenTUI command removed in favor of built-in ANSI TUI

  // Parse normally so --help and errors are handled by commander
  program.parse();
}
