/**
 * Logs command implementation
 */

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { platform } from 'node:os';
import { LOG_FILE } from '@pokecode/core';
import chalk from 'chalk';

export interface LogsOptions {
  follow?: boolean;
  lines: string;
}

export const logs = async (options: LogsOptions): Promise<void> => {
  try {
    const numLines = parseInt(options.lines, 10);

    if (options.follow) {
      console.log(chalk.blue(`📝 Following logs from: ${LOG_FILE}\n`));
      console.log(chalk.gray('Press Ctrl+C to stop following logs\n'));

      await followLogs(LOG_FILE, numLines);
    } else {
      console.log(chalk.blue(`📝 Showing last ${numLines} lines from: ${LOG_FILE}\n`));

      await showLogs(LOG_FILE, numLines);
    }
  } catch (error) {
    console.error(chalk.red('❌ Error reading logs:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
};

const showLogs = async (logFile: string, numLines: number): Promise<void> => {
  try {
    const content = await readFile(logFile, 'utf-8');
    const lines = content.split('\n');
    const lastLines = lines.slice(-numLines).filter((line) => line.trim());

    if (lastLines.length === 0) {
      console.log(chalk.gray('No logs available'));
      return;
    }

    lastLines.forEach((line) => {
      console.log(formatLogLine(line));
    });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      console.log(chalk.gray('Log file not found - server may not have started yet'));
    } else {
      throw error;
    }
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

  child.stderr?.on('data', (_data) => {
    // Ignore stderr for now, as tail might output warnings
  });

  child.on('error', (error) => {
    console.error(chalk.red('❌ Error following logs:'), error.message);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    child.kill();
    console.log(chalk.yellow('\n📝 Stopped following logs'));
    process.exit(0);
  });
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
