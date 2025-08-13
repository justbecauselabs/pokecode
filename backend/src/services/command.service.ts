import { homedir } from 'node:os';
import path from 'node:path';
import type { Command, ListCommandsQuery, ListCommandsResponse } from '@/schemas/command.schema';
import { ValidationError } from '@/types';
import { logger } from '@/utils/logger';

/**
 * Service for discovering and managing slash commands from Claude home and project directories
 */
export class CommandService {
  /**
   * Get the Claude home directory path
   */
  private getClaudeHomePath(): string {
    return path.join(homedir(), '.claude');
  }

  /**
   * Get commands directory path for a given base path
   */
  private getCommandsDirectoryPath(basePath: string): string {
    return path.join(basePath, 'commands');
  }

  /**
   * Check if a directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const file = Bun.file(dirPath);
      const exists = await file.exists();
      if (!exists) return false;

      // Check if it's actually a directory by trying to read it as a directory
      try {
        const dir = new Bun.Glob('*');
        Array.from(dir.scanSync({ cwd: dirPath })); // Just check if we can scan
        return true; // If we can scan it, it's a directory
      } catch {
        return false; // If we can't scan it, it's not a directory
      }
    } catch (_error) {
      return false;
    }
  }

  /**
   * Read markdown files from a commands directory
   */
  private async readCommandsFromDirectory(
    commandsPath: string,
    commandType: 'user' | 'project',
  ): Promise<Command[]> {
    const commands: Command[] = [];

    try {
      // Use Bun.Glob to find all .md files in the directory
      const glob = new Bun.Glob('*.md');
      const files = Array.from(glob.scanSync({ cwd: commandsPath }));

      for (const fileName of files) {
        const fullPath = path.join(commandsPath, fileName);
        const commandName = fileName.slice(0, -3); // Remove .md extension

        try {
          const file = Bun.file(fullPath);
          const content = await file.text();
          commands.push({
            name: commandName,
            body: content,
            type: commandType,
          });

          logger.debug(
            {
              commandName,
              commandType,
              path: fullPath,
              contentLength: content.length,
            },
            'Successfully read command file',
          );
        } catch (error) {
          logger.warn(
            {
              commandName,
              commandType,
              path: fullPath,
              error: error instanceof Error ? error.message : String(error),
            },
            'Failed to read command file',
          );
          // Continue processing other files
        }
      }
    } catch (error) {
      logger.debug(
        {
          commandsPath,
          commandType,
          error: error instanceof Error ? error.message : String(error),
        },
        'Commands directory does not exist or cannot be read',
      );
      return commands;
    }

    return commands;
  }

  /**
   * Filter commands based on query parameters
   */
  private filterCommands(commands: Command[], query: ListCommandsQuery): Command[] {
    let filtered = commands;

    // Filter by type
    if (query.type && query.type !== 'all') {
      filtered = filtered.filter((command) => command.type === query.type);
    }

    // Filter by search term (case-insensitive search in name and body)
    if (query.search) {
      const searchTerm = query.search.toLowerCase();
      filtered = filtered.filter(
        (command) =>
          command.name.toLowerCase().includes(searchTerm) ||
          command.body.toLowerCase().includes(searchTerm),
      );
    }

    return filtered;
  }

  /**
   * List all available slash commands from both user and project directories
   */
  async listCommands(params: {
    sessionId: string;
    projectPath: string;
    query: ListCommandsQuery;
  }): Promise<ListCommandsResponse> {
    const { sessionId, projectPath, query } = params;

    logger.debug(
      {
        sessionId,
        projectPath,
        query,
      },
      'Listing slash commands',
    );

    // Validate project path
    if (!projectPath || !path.isAbsolute(projectPath)) {
      throw new ValidationError('Invalid project path');
    }

    const claudeHomePath = this.getClaudeHomePath();
    const userCommandsPath = this.getCommandsDirectoryPath(claudeHomePath);
    const projectCommandsPath = this.getCommandsDirectoryPath(projectPath);

    const allCommands: Command[] = [];

    // Check if user commands directory exists and read commands
    if (await this.directoryExists(userCommandsPath)) {
      const userCommands = await this.readCommandsFromDirectory(userCommandsPath, 'user');
      allCommands.push(...userCommands);
      logger.debug(
        {
          userCommandsPath,
          count: userCommands.length,
        },
        'Found user commands',
      );
    } else {
      logger.debug(
        {
          userCommandsPath,
        },
        'User commands directory not found',
      );
    }

    // Check if project commands directory exists and read commands
    if (await this.directoryExists(projectCommandsPath)) {
      const projectCommands = await this.readCommandsFromDirectory(projectCommandsPath, 'project');
      allCommands.push(...projectCommands);
      logger.debug(
        {
          projectCommandsPath,
          count: projectCommands.length,
        },
        'Found project commands',
      );
    } else {
      logger.debug(
        {
          projectCommandsPath,
        },
        'Project commands directory not found',
      );
    }

    // Filter commands based on query
    const filteredCommands = this.filterCommands(allCommands, query);

    logger.info(
      {
        sessionId,
        totalCommands: allCommands.length,
        filteredCommands: filteredCommands.length,
        userCommandsPath,
        projectCommandsPath,
      },
      'Successfully listed slash commands',
    );

    const sources: {
      userCommandsPath?: string;
      projectCommandsPath?: string;
    } = {};

    if (await this.directoryExists(userCommandsPath)) {
      sources.userCommandsPath = userCommandsPath;
    }

    if (await this.directoryExists(projectCommandsPath)) {
      sources.projectCommandsPath = projectCommandsPath;
    }

    return {
      commands: filteredCommands,
      sources,
    };
  }
}

// Export singleton instance
export const commandService = new CommandService();
