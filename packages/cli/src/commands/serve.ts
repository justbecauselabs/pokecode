/**
 * Serve command implementation with robust daemon support
 */
import { getConfig, overrideConfig } from '@pokecode/core';
import chalk from 'chalk';
import ora from 'ora';
import { startServer } from '../server';

export interface ServeOptions {
  port: string;
  host: string;
  logLevel: string;
  codexCli?: string;
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
  const useTui = process.stdout.isTTY;

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

  // Optional overrides for Codex CLI path
  const envCodexPath = process.env.CODEX_CLI_PATH;
  const optCodexPath = options.codexCli;
  if (optCodexPath) {
    overrideConfig({ codexCliPath: optCodexPath });
  } else if (envCodexPath) {
    overrideConfig({ codexCliPath: envCodexPath });
  }

  await startEmbedded({ useTui });
};

const startEmbedded = async (params: { useTui: boolean }): Promise<void> => {
  const config = await getConfig();
  const spinner = ora('Starting PokéCode server...').start();

  try {
    if (params.useTui) {
      // Suppress console logging from server when TUI is active
      process.env.POKECODE_TUI = '1';
      process.env.POKECODE_QUIET = '1';
    }
    // Use the new unified server module
    await startServer({ quiet: params.useTui });

    if (params.useTui) {
      spinner.stop();
      const hostForClient =
        config.host === '0.0.0.0' || config.host === '::' ? 'localhost' : config.host;
      const serverUrl = `http://${hostForClient}:${config.port}`;
      const { runDashboard } = await import('../tui');
      runDashboard({ serverUrl, mode: 'foreground' });
      return; // TUI holds the process open
    } else {
      spinner.succeed(chalk.green('✅ PokéCode server started successfully!'));
      console.log(`🚀 Server running at: ${chalk.cyan(`http://${config.host}:${config.port}`)}`);
      console.log(`📝 Logs: ${chalk.gray(config.logFile)}`);
      console.log(`📊 Log level: ${chalk.gray(config.logLevel)}`);
      console.log(`🔍 Claude Code path: ${chalk.gray(config.claudeCodePath)}`);
      console.log(`🤖 Codex CLI path: ${chalk.gray(config.codexCliPath ?? 'not configured')}`);
      if (!config.codexCliPath) {
        console.log(
          chalk.yellow(
            '⚠️  Codex CLI not configured. Codex jobs will fail. Run `pokecode setup` to add it.',
          ),
        );
      }
      console.log(chalk.yellow('\nPress Ctrl+C to stop the server'));
    }
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
