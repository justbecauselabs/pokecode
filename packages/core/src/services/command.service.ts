import type { Command, ListCommandsQuery, ListCommandsResponse } from '@pokecode/api';
import { ValidationError } from '../types';
import {
  directoryExists,
  findMarkdownFiles,
  getBasename,
  getHomeDirectory,
  isAbsolute,
  joinPath,
  readFileContent,
} from '../utils/file';
import { logger } from '../utils/logger';

/**
 * Service for discovering and managing slash commands from Claude home and project directories
 */
export class CommandService {
  /**
   * Get the Claude home directory path
   */
  private getClaudeHomePath(): string {
    return joinPath(getHomeDirectory(), '.claude');
  }

  /**
   * Get commands directory path for a given base path
   */
  private getCommandsDirectoryPath(basePath: string): string {
    return joinPath(basePath, 'commands');
  }

  /**
   * Check if a directory exists using File Service
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    logger.debug({ dirPath }, 'Checking if directory exists');
    try {
      const exists = await directoryExists(dirPath);
      if (!exists) {
        logger.debug({ dirPath }, 'Directory does not exist or not accessible');
      }
      return exists;
    } catch (error) {
      logger.debug(
        { dirPath, error: error instanceof Error ? error.message : String(error) },
        'Error checking if directory exists',
      );
      return false;
    }
  }

  /**
   * Read markdown files from a commands directory using File Service
   */
  private async readCommandsFromDirectory(
    commandsPath: string,
    commandType: 'user' | 'project',
  ): Promise<Command[]> {
    const commands: Command[] = [];

    logger.debug({ commandsPath, commandType }, 'Starting to read commands from directory');

    try {
      // Use File Utils to find markdown files
      const markdownFiles = await findMarkdownFiles(commandsPath);

      logger.debug(
        {
          commandsPath,
          commandType,
          files: markdownFiles.map((f) => getBasename(f)),
          fileCount: markdownFiles.length,
        },
        'Found .md files in directory',
      );

      for (const filePath of markdownFiles) {
        const commandName = getBasename(filePath, '.md');

        try {
          const fileContent = await readFileContent(filePath);
          commands.push({
            name: commandName,
            body: fileContent,
            type: commandType,
          });

          logger.debug(
            {
              commandName,
              commandType,
              path: filePath,
              contentLength: fileContent.length,
            },
            'Successfully read command file',
          );
        } catch (error) {
          logger.warn(
            {
              commandName,
              commandType,
              path: filePath,
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
    if (!projectPath || !isAbsolute(projectPath)) {
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
