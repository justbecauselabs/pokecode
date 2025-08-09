/**
 * Authentication screen using Clack prompts
 */

import { intro, outro, text, password, select, confirm, spinner, cancel, isCancel } from '@clack/prompts';
import chalk from 'chalk';
import { AuthService } from '../services/auth.service';
import { ConfigService } from '../services/config.service';
import { Logger } from '../utils/logger';
import { formatError } from '../utils/errors';

export class AuthScreen {
  private authService: AuthService;
  private configService: ConfigService;
  private logger: Logger;

  constructor() {
    this.authService = AuthService.getInstance();
    this.configService = ConfigService.getInstance();
    this.logger = Logger.getInstance();
  }

  /**
   * Show authentication flow
   */
  public async show(): Promise<boolean> {
    intro(chalk.cyan('Welcome to PokeCode CLI'));

    const action = await select({
      message: 'What would you like to do?',
      options: [
        { value: 'login', label: 'Login with existing account' },
        { value: 'register', label: 'Register new account' },
        { value: 'exit', label: 'Exit' },
      ],
    });

    if (isCancel(action) || action === 'exit') {
      cancel('Goodbye!');
      return false;
    }

    if (action === 'login') {
      return await this.handleLogin();
    } else if (action === 'register') {
      return await this.handleRegistration();
    }

    return false;
  }

  /**
   * Handle login flow
   */
  private async handleLogin(): Promise<boolean> {
    const email = await text({
      message: 'Enter your email:',
      placeholder: 'user@example.com',
      validate: (value) => {
        if (!value) return 'Email is required';
        if (!this.isValidEmail(value)) return 'Please enter a valid email';
        return;
      },
    });

    if (isCancel(email)) {
      cancel('Login cancelled');
      return false;
    }

    const pass = await password({
      message: 'Enter your password:',
      validate: (value) => {
        if (!value) return 'Password is required';
        if (value.length < 6) return 'Password must be at least 6 characters';
        return;
      },
    });

    if (isCancel(pass)) {
      cancel('Login cancelled');
      return false;
    }

    const s = spinner();
    s.start('Logging in...');

    try {
      const user = await this.authService.login(email as string, pass as string);
      s.stop('Logged in successfully!');
      
      outro(chalk.green(`✓ Welcome back, ${user.name || user.email}!`));
      return true;
    } catch (error) {
      s.stop('Login failed');
      outro(chalk.red(formatError(error)));
      
      const retry = await confirm({
        message: 'Would you like to try again?',
      });

      if (!isCancel(retry) && retry) {
        return await this.handleLogin();
      }
      
      return false;
    }
  }

  /**
   * Handle registration flow
   */
  private async handleRegistration(): Promise<boolean> {
    const email = await text({
      message: 'Enter your email:',
      placeholder: 'user@example.com',
      validate: (value) => {
        if (!value) return 'Email is required';
        if (!this.isValidEmail(value)) return 'Please enter a valid email';
        return;
      },
    });

    if (isCancel(email)) {
      cancel('Registration cancelled');
      return false;
    }

    const name = await text({
      message: 'Enter your name (optional):',
      placeholder: 'John Doe',
    });

    if (isCancel(name)) {
      cancel('Registration cancelled');
      return false;
    }

    const pass = await password({
      message: 'Create a password:',
      validate: (value) => {
        if (!value) return 'Password is required';
        if (value.length < 6) return 'Password must be at least 6 characters';
        return;
      },
    });

    if (isCancel(pass)) {
      cancel('Registration cancelled');
      return false;
    }

    const confirmPass = await password({
      message: 'Confirm your password:',
      validate: (value) => {
        if (value !== pass) return 'Passwords do not match';
        return;
      },
    });

    if (isCancel(confirmPass)) {
      cancel('Registration cancelled');
      return false;
    }

    const s = spinner();
    s.start('Creating account...');

    try {
      const user = await this.authService.register(
        email as string, 
        pass as string, 
        name as string || undefined
      );
      s.stop('Account created successfully!');
      
      outro(chalk.green(`✓ Welcome to PokeCode, ${user.name || user.email}!`));
      return true;
    } catch (error) {
      s.stop('Registration failed');
      outro(chalk.red(formatError(error)));
      
      const retry = await confirm({
        message: 'Would you like to try again?',
      });

      if (!isCancel(retry) && retry) {
        return await this.handleRegistration();
      }
      
      return false;
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}