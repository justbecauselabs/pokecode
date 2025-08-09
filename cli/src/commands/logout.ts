#!/usr/bin/env bun
/**
 * Logout command for PokeCode CLI
 */

import { AuthService } from '../services/auth.service';
import { ConfigService } from '../services/config.service';
import { Logger } from '../utils/logger';
import chalk from 'chalk';
import { confirm, isCancel } from '@clack/prompts';

async function main(): Promise<void> {
  const authService = AuthService.getInstance();
  const config = ConfigService.getInstance();
  const logger = Logger.getInstance();

  // Check if authenticated
  if (!config.isAuthenticated()) {
    logger.info('You are not currently logged in');
    return;
  }

  const auth = config.getAuth();
  console.log(chalk.cyan(`Currently logged in as: ${auth?.user.email}`));

  // Confirm logout
  const shouldLogout = await confirm({
    message: 'Are you sure you want to logout?',
  });

  if (isCancel(shouldLogout) || !shouldLogout) {
    console.log(chalk.gray('Logout cancelled'));
    return;
  }

  try {
    await authService.logout();
    console.log(chalk.green('✓ Logged out successfully'));
  } catch (error) {
    logger.error('Logout failed', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});