/**
 * Logs command implementation
 */

import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import { getConfig } from '@pokecode/core';
import chalk from 'chalk';

export interface LogsOptions {
  follow?: boolean;
  lines: string;
}

export const logs = async (options: LogsOptions): Promise<void> => {
  const config = await getConfig();

  try {
    const logFile = config.logFile;
    const numLines = parseInt(options.lines, 10);

    // Validate parsed number
    if (Number.isNaN(numLines) || numLines <= 0) {
      throw new Error(`Invalid number of lines: ${options.lines}. Must be a positive integer.`);
    }

    if (options.follow) {
      console.log(chalk.blue(`📝 Following logs from: ${logFile}\n`));
      console.log(chalk.gray('Press Ctrl+C to stop following logs\n'));

      await followLogs(logFile, numLines);
    } else {
      console.log(chalk.blue(`📝 Showing last ${numLines} lines from: ${logFile}\n`));

      await showLogs(logFile, numLines);
    }
  } catch (error) {
    console.error(chalk.red('❌ Error reading logs:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
};

const showLogs = async (logFile: string, numLines: number): Promise<void> => {
  try {
    const file = Bun.file(logFile);

    if (!(await file.exists())) {
      console.log(chalk.gray('Log file not found - server may not have started yet'));
      return;
    }

    const content = await file.text();
    const lines = content.split('\n');
    const lastLines = lines.slice(-numLines).filter((line) => line.trim());

    if (lastLines.length === 0) {
      console.log(chalk.gray('No logs available'));
      return;
    }

    for (const line of lastLines) {
      console.log(formatLogLine(line));
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read log file: ${errorMessage}`);
  }
};

const followLogs = async (logFile: string, numLines: number): Promise<void> => {
  const isWindows = platform() === 'win32';

  // Show initial lines first
  await showLogs(logFile, numLines);

  // Then follow new lines
  const tailCommand = isWindows ? 'Get-Content' : 'tail';
  const tailArgs = isWindows
    ? ['-Path', logFile, '-Wait', '-Tail', '0']
    : ['-f', '-n', '0', logFile];

  const child = spawn(tailCommand, tailArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (data) => {
    const lines = data
      .toString()
      .split('\n')
      .filter((line: string) => line.trim());
    lines.forEach((line: string) => {
      console.log(formatLogLine(line));
    });
  });

  child.stderr?.on('data', (data) => {
    // Only show stderr if it's not just warnings
    const errorText = data.toString().trim();
    if (errorText && !errorText.includes('warning')) {
      console.error(chalk.red('⚠️  Tail error:'), errorText);
    }
  });

  child.on('error', (error) => {
    console.error(chalk.red('❌ Error following logs:'), error.message);
    process.exit(1);
  });

  child.on('close', (code) => {
    if (code !== 0) {
      console.error(chalk.red(`❌ Tail process exited with code ${code}`));
      process.exit(1);
    }
  });

  // Handle graceful shutdown
  const handleShutdown = () => {
    if (!child.killed) {
      child.kill('SIGTERM');
      console.log(chalk.yellow('\n📝 Stopped following logs'));
    }
    process.exit(0);
  };

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);
};

const formatLogLine = (line: string): string => {
  // Try to parse JSON logs
  try {
    const logObj = JSON.parse(line);

    const timestamp = logObj.time ? new Date(logObj.time).toLocaleTimeString() : '';
    const level = logObj.level || 'info';
    const message = logObj.msg || logObj.message || line;

    // Color code by log level
    let levelColor = chalk.gray;
    switch (level) {
      case 'error':
        levelColor = chalk.red;
        break;
      case 'warn':
        levelColor = chalk.yellow;
        break;
      case 'info':
        levelColor = chalk.blue;
        break;
      case 'debug':
        levelColor = chalk.cyan;
        break;
      case 'trace':
        levelColor = chalk.magenta;
        break;
    }

    return `${chalk.gray(timestamp)} ${levelColor(level.toUpperCase())} ${message}`;
  } catch {
    // Not JSON, return as-is
    return line;
  }
};
