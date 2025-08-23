/**
 * Serve command implementation with robust daemon support
 */

import { getConfig, overrideConfig } from '@pokecode/core';
import chalk from 'chalk';
import ora from 'ora';
import { startServer } from '../server';
import { DaemonManager } from '../utils/daemon';
import { spawnDetached } from '../utils/runtime';

export interface ServeOptions {
  port: string;
  host: string;
  daemon?: boolean;
  logLevel: string;
}

// Security validation functions
const validatePort = (portStr: string): number => {
  const port = parseInt(portStr, 10);

  if (Number.isNaN(port)) {
    throw new Error(`Invalid port: "${portStr}". Port must be a number.`);
  }

  if (port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${port}. Port must be between 1 and 65535.`);
  }

  if (port < 1024) {
    throw new Error(`Port ${port} requires root privileges. Use a port >= 1024.`);
  }

  return port;
};

const validateHost = (host: string): string => {
  // Sanitize host input
  const sanitized = host.trim();

  // Allow localhost, 127.0.0.1, 0.0.0.0, and valid IP addresses
  const validHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
  const ipRegex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  if (!validHosts.includes(sanitized) && !ipRegex.test(sanitized)) {
    throw new Error(
      `Invalid host: "${host}". Use localhost, 127.0.0.1, 0.0.0.0, or a valid IP address.`,
    );
  }

  return sanitized;
};

const validateLogLevel = (level: string): string => {
  const validLevels = ['trace', 'debug', 'info', 'warn', 'error'];
  const sanitized = level.toLowerCase().trim();

  if (!validLevels.includes(sanitized)) {
    throw new Error(`Invalid log level: "${level}". Valid levels: ${validLevels.join(', ')}`);
  }

  return sanitized;
};

export const serve = async (options: ServeOptions): Promise<void> => {
  const daemonManager = new DaemonManager();

  // Validate and sanitize inputs
  const port = validatePort(options.port);
  const host = validateHost(options.host);
  const logLevel = validateLogLevel(options.logLevel);

  // Set CLI overrides FIRST before any services call getConfig()
  overrideConfig({
    port,
    host,
    logLevel: logLevel as 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace',
  });

  // Check if daemon is already running
  if (await daemonManager.isRunning()) {
    const info = await daemonManager.getDaemonInfo();
    console.log(chalk.yellow('⚠️  PokéCode server is already running!'));
    if (info) {
      console.log(`   Running on: http://${info.host}:${info.port}`);
      console.log(`   PID: ${info.pid}`);
      console.log(`   Started: ${info.startTime}`);
    }
    console.log('\nUse "pokecode stop" to stop the server first.');
    return;
  }

  if (options.daemon) {
    await startDaemon();
  } else {
    await startEmbedded();
  }
};

const startDaemon = async (): Promise<void> => {
  const config = await getConfig();
  const spinner = ora('Starting PokéCode server in daemon mode...').start();
  const daemonManager = new DaemonManager();

  try {
    const env: Record<string, string> = {
      NODE_ENV: 'production',
    };

    // Re-exec the current process (handle both dev and compiled modes)
    let execPath: string;
    let execArgs: string[];

    // Check if we're running from a compiled binary or development mode
    if (process.argv[1]?.endsWith('.ts')) {
      // Development mode: bun src/cli.ts
      execPath = process.execPath; // bun executable
      execArgs = [process.argv[1], '--internal-run-server']; // [src/cli.ts, --internal-run-server]
    } else {
      // Compiled binary mode
      execPath = process.execPath; // compiled binary path
      execArgs = ['--internal-run-server'];
    }

    const child = spawnDetached(execPath, execArgs, {
      env: Object.fromEntries(
        Object.entries({ ...process.env, ...env }).filter(([, value]) => value !== undefined),
      ) as Record<string, string>,
      stdout: config.logFile,
      stderr: config.logFile,
    });

    if (!child.pid) throw new Error('Failed to start daemon process');

    await daemonManager.saveDaemonInfo({
      pid: child.pid,
      port: config.port,
      host: config.host,
      startTime: new Date().toISOString(),
    });

    spinner.succeed(chalk.green('✅ PokéCode server started in daemon mode!'));
    console.log(`🚀 Server running at: ${chalk.cyan(`http://${config.host}:${config.port}`)}`);
    console.log(`📝 Logs: ${chalk.gray(config.logFile)}`);
    console.log(`🆔 PID: ${chalk.gray(child.pid)}`);
    console.log('\nUse the following commands:');
    console.log(`  ${chalk.cyan('pokecode status')} - Check server status`);
    console.log(`  ${chalk.cyan('pokecode logs -f')} - Follow logs`);
    console.log(`  ${chalk.cyan('pokecode stop')} - Stop the server`);

    // Parent exits immediately to detach
    process.exit(0);
  } catch (error) {
    spinner.fail(chalk.red('❌ Failed to start PokéCode server'));
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));

    // Clean up on failure
    await daemonManager.cleanup();
    process.exit(1);
  }
};

const startEmbedded = async (): Promise<void> => {
  const config = await getConfig();
  const spinner = ora('Starting PokéCode server...').start();

  try {
    // Use the new unified server module
    await startServer();

    spinner.succeed(chalk.green('✅ PokéCode server started successfully!'));
    console.log(`🚀 Server running at: ${chalk.cyan(`http://${config.host}:${config.port}`)}`);
    console.log(`📝 Logs: ${chalk.gray(config.logFile)}`);
    console.log(`📊 Log level: ${chalk.gray(config.logLevel)}`);
    console.log(`🔍 Claude Code path: ${chalk.gray(config.claudeCodePath)}`);
    console.log(chalk.yellow('\nPress Ctrl+C to stop the server'));
  } catch (error) {
    spinner.fail(chalk.red('❌ Failed to start PokéCode server'));
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(chalk.gray('Stack trace:'), error.stack);
    }
    console.error(chalk.gray('Config:'), JSON.stringify(config, null, 2));
    process.exit(1);
  }
};
