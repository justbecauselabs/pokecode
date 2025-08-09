#!/usr/bin/env bun
/**
 * Login command for PokeCode CLI
 */

import { AuthScreen } from '../screens/AuthScreen';
import { ConfigService } from '../services/config.service';
import { Logger } from '../utils/logger';
import chalk from 'chalk';

async function main(): Promise<void> {
  const config = ConfigService.getInstance();
  const logger = Logger.getInstance();

  // Check if already authenticated
  if (config.isAuthenticated()) {
    const auth = config.getAuth();
    logger.info(`Already logged in as ${auth?.user.email}`);
    
    console.log(chalk.yellow('\nTo switch accounts, run: pokecode logout'));
    return;
  }

  // Show authentication screen
  const authScreen = new AuthScreen();
  const success = await authScreen.show();

  if (success) {
    console.log(chalk.cyan('\nYou can now start a chat session with: pokecode chat'));
  }

  process.exit(success ? 0 : 1);
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});