/**
 * Session selection screen using Clack prompts
 */

import { intro, outro, select, text, confirm, spinner, cancel, isCancel } from '@clack/prompts';
import chalk from 'chalk';
import { SessionService } from '../services/session.service';
import { Logger } from '../utils/logger';
import { formatError } from '../utils/errors';
import type { Session } from '../types/api';

export class SessionScreen {
  private sessionService: SessionService;
  private logger: Logger;

  constructor() {
    this.sessionService = SessionService.getInstance();
    this.logger = Logger.getInstance();
  }

  /**
   * Show session selection screen
   */
  public async show(): Promise<Session | null> {
    intro(chalk.cyan('Session Management'));

    // Check for recent sessions
    const recentSessions = this.sessionService.getRecentSessions();
    const hasRecent = recentSessions.length > 0;

    const action = await select({
      message: 'Select a session option:',
      options: [
        ...(hasRecent ? [{ 
          value: 'resume', 
          label: `Resume recent session (${recentSessions[0]?.projectPath})` 
        }] : []),
        { value: 'new', label: 'Create new session' },
        { value: 'list', label: 'Choose from existing sessions' },
        { value: 'cancel', label: 'Cancel' },
      ],
    });

    if (isCancel(action) || action === 'cancel') {
      cancel('Session selection cancelled');
      return null;
    }

    switch (action) {
      case 'resume':
        return await this.resumeRecentSession();
      case 'new':
        return await this.createNewSession();
      case 'list':
        return await this.selectExistingSession();
      default:
        return null;
    }
  }

  /**
   * Resume the most recent session
   */
  private async resumeRecentSession(): Promise<Session | null> {
    const s = spinner();
    s.start('Resuming recent session...');

    try {
      const session = await this.sessionService.resumeRecentSession();
      
      if (session) {
        s.stop('Session resumed successfully!');
        outro(chalk.green(`✓ Resumed session: ${session.projectPath}`));
        return session;
      } else {
        s.stop('Recent session not found');
        const createNew = await confirm({
          message: 'Would you like to create a new session?',
        });

        if (!isCancel(createNew) && createNew) {
          return await this.createNewSession();
        }
        return null;
      }
    } catch (error) {
      s.stop('Failed to resume session');
      outro(chalk.red(formatError(error)));
      return null;
    }
  }

  /**
   * Create a new session
   */
  private async createNewSession(): Promise<Session | null> {
    const projectPath = await text({
      message: 'Enter project path:',
      placeholder: '/path/to/your/project',
      defaultValue: process.cwd(),
      validate: (value) => {
        if (!value) return 'Project path is required';
        return;
      },
    });

    if (isCancel(projectPath)) {
      cancel('Session creation cancelled');
      return null;
    }

    const context = await text({
      message: 'Enter context (optional):',
      placeholder: 'Working on feature X, using TypeScript and React...',
    });

    if (isCancel(context)) {
      cancel('Session creation cancelled');
      return null;
    }

    const s = spinner();
    s.start('Creating session...');

    try {
      const session = await this.sessionService.createSession(
        projectPath as string,
        context as string || undefined
      );
      
      s.stop('Session created successfully!');
      outro(chalk.green(`✓ Created session for: ${session.projectPath}`));
      return session;
    } catch (error) {
      s.stop('Failed to create session');
      outro(chalk.red(formatError(error)));
      
      const retry = await confirm({
        message: 'Would you like to try again?',
      });

      if (!isCancel(retry) && retry) {
        return await this.createNewSession();
      }
      
      return null;
    }
  }

  /**
   * Select from existing sessions
   */
  private async selectExistingSession(): Promise<Session | null> {
    const s = spinner();
    s.start('Fetching sessions...');

    try {
      const sessions = await this.sessionService.listSessions();
      s.stop();

      if (sessions.length === 0) {
        console.log(chalk.yellow('No existing sessions found'));
        
        const createNew = await confirm({
          message: 'Would you like to create a new session?',
        });

        if (!isCancel(createNew) && createNew) {
          return await this.createNewSession();
        }
        return null;
      }

      const selectedId = await select({
        message: 'Select a session:',
        options: [
          ...sessions.map(session => ({
            value: session.id,
            label: `${session.projectPath} ${session.status === 'active' ? chalk.green('●') : chalk.gray('○')} ${chalk.gray(this.formatDate(session.lastAccessedAt))}`,
            hint: session.context || 'No context'
          })),
          { value: 'new', label: chalk.cyan('+ Create new session') },
          { value: 'cancel', label: 'Cancel' }
        ],
      });

      if (isCancel(selectedId) || selectedId === 'cancel') {
        cancel('Session selection cancelled');
        return null;
      }

      if (selectedId === 'new') {
        return await this.createNewSession();
      }

      // Get full session details
      const session = await this.sessionService.getSession(selectedId as string);
      
      // Update recent sessions
      this.sessionService.setCurrentSession(session.id);
      
      outro(chalk.green(`✓ Selected session: ${session.projectPath}`));
      return session;
    } catch (error) {
      s.stop('Failed to fetch sessions');
      outro(chalk.red(formatError(error)));
      return null;
    }
  }

  /**
   * Format date for display
   */
  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }
}