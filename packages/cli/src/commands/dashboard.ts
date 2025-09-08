import { getConfig } from '@pokecode/core';
import chalk from 'chalk';
import ora from 'ora';
import { runDashboard } from '../tui';

export interface DashboardOptions {
  host?: string;
  port?: string;
}

export async function dashboard(options: DashboardOptions = {}): Promise<void> {
  const spinner = ora('Connecting to PokéCode server...').start();
  try {
    const defaultConfig = await getConfig();
    const host = (options.host ?? 'localhost').trim();
    const portStr = options.port ?? String(defaultConfig.port);
    const port = Number.parseInt(portStr, 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid port: ${portStr}`);
    }
    const serverUrl = `http://${host}:${port}`;
    spinner.stop();
    runDashboard({ serverUrl, mode: 'attach' });
  } catch (error) {
    spinner.fail(chalk.red('Failed to open dashboard'));
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('Error:'), message);
    process.exit(1);
  }
}
