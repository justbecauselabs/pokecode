/**
 * Logging utility for debug and verbose modes
 */

import chalk from 'chalk';
import { ConfigService } from '../services/config.service';

export class Logger {
  private static instance: Logger;
  private config: ConfigService;

  private constructor() {
    this.config = ConfigService.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Log debug message (only in debug mode)
   */
  public debug(message: string, data?: unknown): void {
    if (this.config.isDebugMode()) {
      console.log(chalk.gray(`[DEBUG] ${message}`));
      if (data !== undefined) {
        console.log(chalk.gray(JSON.stringify(data, null, 2)));
      }
    }
  }

  /**
   * Log verbose message (only in verbose mode)
   */
  public verbose(message: string, data?: unknown): void {
    if (this.config.isVerboseMode() || this.config.isDebugMode()) {
      console.log(chalk.blue(`[VERBOSE] ${message}`));
      if (data !== undefined) {
        console.log(chalk.blue(JSON.stringify(data, null, 2)));
      }
    }
  }

  /**
   * Log info message
   */
  public info(message: string): void {
    console.log(chalk.cyan(`ℹ ${message}`));
  }

  /**
   * Log success message
   */
  public success(message: string): void {
    console.log(chalk.green(`✓ ${message}`));
  }

  /**
   * Log warning message
   */
  public warn(message: string): void {
    console.log(chalk.yellow(`⚠ ${message}`));
  }

  /**
   * Log error message
   */
  public error(message: string, error?: unknown): void {
    console.error(chalk.red(`✗ ${message}`));
    if (error && (this.config.isDebugMode() || this.config.isVerboseMode())) {
      console.error(chalk.red(error instanceof Error ? error.stack : String(error)));
    }
  }

  /**
   * Log API request (debug mode only)
   */
  public request(method: string, url: string, body?: unknown): void {
    if (this.config.isDebugMode()) {
      console.log(chalk.magenta(`→ ${method} ${url}`));
      if (body) {
        console.log(chalk.magenta(JSON.stringify(body, null, 2)));
      }
    }
  }

  /**
   * Log API response (debug mode only)
   */
  public response(status: number, url: string, body?: unknown): void {
    if (this.config.isDebugMode()) {
      const color = status >= 200 && status < 300 ? chalk.green : chalk.red;
      console.log(color(`← ${status} ${url}`));
      if (body && this.config.isVerboseMode()) {
        console.log(color(JSON.stringify(body, null, 2)));
      }
    }
  }
}