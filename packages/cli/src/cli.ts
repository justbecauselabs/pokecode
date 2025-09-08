#!/usr/bin/env bun
// Disable server/worker console logging whenever CLI is used.
// Must run before any dynamic imports that might load @pokecode/core/@pokecode/server.
process.env.POKECODE_TUI = '1';
process.env.POKECODE_QUIET = '1';

import { program } from 'commander';

// Handle internal server mode
if (process.argv.includes('--internal-run-server')) {
  // Run internal server (legacy path). Import after env is set above.
  const { startServer } = await import('./server');
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
    .action(async (opts) => {
      const { serve } = await import('./commands/serve');
      return serve(opts);
    });

  // status/stop removed; server runs in foreground

  program
    .command('logs')
    .description('Show server logs')
    .option('-f, --follow', 'Follow log output')
    .option('-n, --lines <number>', 'Number of lines to show', '50')
    .action(async (opts) => {
      const { logs } = await import('./commands/logs');
      return logs(opts);
    });

  program
    .command('setup')
    .description('Setup PokéCode with Claude Code path')
    .action(async () => {
      const { setup } = await import('./commands/setup');
      return setup({});
    });

  // Experimental OpenTUI command removed in favor of built-in ANSI TUI

  // Parse normally so --help and errors are handled by commander
  program.parse();
}
