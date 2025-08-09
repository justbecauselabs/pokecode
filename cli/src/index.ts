#!/usr/bin/env bun
/**
 * PokeCode CLI - Entry point
 */

import { ConfigService } from './services/config.service';
import { Logger } from './utils/logger';
import { AuthScreen } from './screens/AuthScreen';
import chalk from 'chalk';

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
const debugMode = args.includes('--debug');
const verboseMode = args.includes('--verbose');

// Initialize services
const config = ConfigService.getInstance();
const logger = Logger.getInstance();

// Set debug/verbose modes if provided
if (debugMode) {
  config.setDebugMode(true);
}
if (verboseMode) {
  config.setVerboseMode(true);
}

async function showHelp(): Promise<void> {
  console.log(chalk.cyan('\nPokeCode CLI v1.0.0\n'));
  console.log('Usage: pokecode [command] [options]\n');
  console.log('Commands:');
  console.log('  login       Login or register');
  console.log('  logout      Logout current user');
  console.log('  chat        Start a chat session');
  console.log('  help        Show this help message\n');
  console.log('Options:');
  console.log('  --debug     Enable debug mode');
  console.log('  --verbose   Enable verbose mode\n');
}

async function main(): Promise<void> {
  try {
    // Handle commands
    switch (command) {
      case 'login':
        await handleLogin();
        break;
      
      case 'logout':
        await handleLogout();
        break;
      
      case 'chat':
        await handleChat();
        break;
      
      case 'help':
      case undefined:
        await showHelp();
        break;
      
      default:
        console.log(chalk.red(`Unknown command: ${command}`));
        await showHelp();
        process.exit(1);
    }
  } catch (error) {
    logger.error('Fatal error', error);
    process.exit(1);
  }
}

async function handleLogin(): Promise<void> {
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

async function handleLogout(): Promise<void> {
  const { AuthService } = await import('./services/auth.service');
  const { confirm, isCancel } = await import('@clack/prompts');
  
  const authService = AuthService.getInstance();

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

async function handleChat(): Promise<void> {
  // Check authentication
  if (!config.isAuthenticated()) {
    console.log(chalk.yellow('You need to login first'));
    console.log(chalk.cyan('Run: pokecode login'));
    process.exit(1);
  }

  const auth = config.getAuth();
  console.log(chalk.green(`✓ Authenticated as ${auth?.user.email}`));
  
  // Import session screen
  const { SessionScreen } = await import('./screens/SessionScreen');
  const sessionScreen = new SessionScreen();
  
  // Show session selection/creation
  const session = await sessionScreen.show();
  
  if (!session) {
    console.log(chalk.yellow('No session selected'));
    process.exit(1);
  }
  
  console.log(chalk.cyan(`\n📁 Session: ${session.projectPath}`));
  if (session.context) {
    console.log(chalk.gray(`Context: ${session.context}`));
  }
  console.log(chalk.cyan('\nLaunching chat interface...\n'));
  
  // Launch Ink chat interface
  const { launchChatInterface } = await import('./app');
  launchChatInterface(session);
}

// Run the application
main().catch(console.error);