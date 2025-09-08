/**
 * Stop command implementation
 */
import chalk from 'chalk';
import ora from 'ora';
import { DaemonManager } from '../utils/daemon';

export interface StopOptions {
  force?: boolean;
}

export const stop = async (options: StopOptions): Promise<void> => {
  const daemonManager = new DaemonManager();
  const spinner = ora('Checking server status...').start();

  try {
    const isRunning = await daemonManager.isRunning();

    if (!isRunning) {
      spinner.info(chalk.yellow('PokéCode server is not running'));
      return;
    }

    const info = await daemonManager.getDaemonInfo();
    spinner.text = options.force ? 'Force stopping server...' : 'Gracefully stopping server...';

    const stopped = await daemonManager.stop(options.force);

    if (stopped) {
      spinner.succeed(chalk.green('✅ PokéCode server stopped successfully'));

      if (info) {
        const startTime = new Date(info.startTime);
        const uptime = Date.now() - startTime.getTime();
        const uptimeStr = formatUptime(uptime);
        console.log(`Server was running for: ${chalk.gray(uptimeStr)}`);
      }
    } else {
      spinner.fail(chalk.red('❌ Failed to stop server'));
      console.log('\nTry using the --force flag to force stop the server:');
      console.log(chalk.cyan('pokecode stop --force'));
    }
  } catch (error) {
    spinner.fail(chalk.red('❌ Error stopping server'));
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

const formatUptime = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};
