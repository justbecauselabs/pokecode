/**
 * Status command implementation
 */

import type { HealthResponse } from '@pokecode/api';
import { HealthResponseSchema } from '@pokecode/api';
import { LOG_FILE } from '@pokecode/core';
import chalk from 'chalk';
import { DaemonManager } from '../utils/daemon';

export interface StatusOptions {
  port: string;
  host: string;
}

export const status = async (_options: StatusOptions): Promise<void> => {
  const daemonManager = new DaemonManager();

  console.log(chalk.blue('🔍 Checking PokéCode server status...\n'));

  try {
    const isRunning = await daemonManager.isRunning();

    if (!isRunning) {
      console.log(chalk.red('❌ PokéCode server is not running'));
      console.log(`\nTo start the server, run: ${chalk.cyan('pokecode serve')}`);
      return;
    }

    const info = await daemonManager.getDaemonInfo();
    if (!info) {
      console.log(chalk.yellow('⚠️  Server appears to be running but daemon info is unavailable'));
      return;
    }

    console.log(chalk.green('✅ PokéCode server is running'));
    console.log(`📍 URL: ${chalk.cyan(`http://${info.host}:${info.port}`)}`);
    console.log(`🔢 PID: ${chalk.gray(info.pid)}`);
    console.log(`⏰ Started: ${chalk.gray(info.startTime)}`);
    console.log(`� Log file: ${chalk.gray(LOG_FILE)}`);

    // Calculate uptime
    const startTime = new Date(info.startTime);
    const uptime = Date.now() - startTime.getTime();
    const uptimeSeconds = Math.floor(uptime / 1000);
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);

    let uptimeStr = '';
    if (uptimeHours > 0) {
      uptimeStr = `${uptimeHours}h ${uptimeMinutes % 60}m`;
    } else if (uptimeMinutes > 0) {
      uptimeStr = `${uptimeMinutes}m ${uptimeSeconds % 60}s`;
    } else {
      uptimeStr = `${uptimeSeconds}s`;
    }
    console.log(`⏱️  Uptime: ${chalk.gray(uptimeStr)}`);

    // Try to ping the server
    try {
      const response = await fetch(`http://${info.host}:${info.port}/health`);
      if (response.ok) {
        const rawData = await response.json();
        const parseResult = HealthResponseSchema.safeParse(rawData);

        if (parseResult.success) {
          const data: HealthResponse = parseResult.data;
          console.log(`🩺 Health check: ${chalk.green('OK')}`);
          console.log(`📦 Version: ${chalk.gray(data.version)}`);

          // Show service statuses
          const dbStatus = data.services.database;
          const queueStatus = data.services.queue;

          console.log(
            `💾 Database: ${dbStatus === 'healthy' ? chalk.green(dbStatus) : dbStatus === 'unhealthy' ? chalk.red(dbStatus) : chalk.yellow(dbStatus)}`,
          );
          console.log(
            `📋 Queue: ${queueStatus === 'healthy' ? chalk.green(queueStatus) : queueStatus === 'unhealthy' ? chalk.red(queueStatus) : chalk.yellow(queueStatus)}`,
          );
        } else {
          console.log(`🩺 Health check: ${chalk.yellow('DEGRADED')} (Invalid response format)`);
        }
      } else {
        console.log(`🩺 Health check: ${chalk.yellow('DEGRADED')} (HTTP ${response.status})`);
      }
    } catch (error) {
      console.log(
        `🩺 Health check: ${chalk.red('FAILED')} (${error instanceof Error ? error.message : 'Unknown error'})`,
      );
    }
  } catch (error) {
    console.error(chalk.red('❌ Error checking server status:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
};
