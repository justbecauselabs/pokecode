import type { Agent, ListAgentsQuery, ListAgentsResponse } from '@pokecode/api';
import { ValidationError } from '@/types';
import {
  directoryExists,
  findMarkdownFiles,
  getHomeDirectory,
  isAbsolute,
  joinPath,
  readMarkdownFile,
} from '@/utils/file';
import { logger } from '@/utils/logger';

/**
 * Service for discovering and managing agents from Claude home and project directories
 */
export class AgentService {
  /**
   * Get the Claude home directory path
   */
  private getClaudeHomePath(): string {
    return joinPath(getHomeDirectory(), '.claude');
  }

  /**
   * Get agents directory path for user (Claude home) or project
   */
  private getAgentsDirectoryPath(basePath: string, isUserPath = false): string {
    if (isUserPath) {
      // For user agents: ~/.claude/agents
      return joinPath(basePath, 'agents');
    } else {
      // For project agents: {projectPath}/.claude/agents
      return joinPath(basePath, '.claude', 'agents');
    }
  }

  /**
   * Read markdown files from an agents directory
   */
  private async readAgentsFromDirectory(
    agentsPath: string,
    agentType: 'user' | 'project',
  ): Promise<Agent[]> {
    const agents: Agent[] = [];

    try {
      // Use file utils to find all markdown files
      const markdownFiles = await findMarkdownFiles(agentsPath);

      for (const filePath of markdownFiles) {
        try {
          const { frontMatter, content, fileName } = await readMarkdownFile(filePath);

          // Use name from frontmatter if available, otherwise use filename
          const agentName =
            (typeof frontMatter.name === 'string' ? frontMatter.name : fileName) || fileName;
          const agentDescription =
            (typeof frontMatter.description === 'string' ? frontMatter.description : '') || '';

          if (!agentDescription) {
            logger.warn(
              {
                agentName,
                agentType,
                path: filePath,
              },
              'Agent has no description in frontmatter',
            );
          }

          const agent: Agent = {
            name: agentName,
            description: agentDescription,
            content,
            type: agentType,
          };

          // Only add color if it exists
          if (frontMatter.color && typeof frontMatter.color === 'string') {
            agent.color = frontMatter.color;
          }

          agents.push(agent);

          logger.debug(
            {
              agentName,
              agentType,
              path: filePath,
              contentLength: content.length,
              hasDescription: !!agentDescription,
              hasColor: !!frontMatter.color,
            },
            'Successfully read agent file',
          );
        } catch (error) {
          logger.warn(
            {
              filePath,
              agentType,
              error: error instanceof Error ? error.message : String(error),
            },
            'Failed to read agent file',
          );
          // Continue processing other files
        }
      }
    } catch (error) {
      logger.debug(
        {
          agentsPath,
          agentType,
          error: error instanceof Error ? error.message : String(error),
        },
        'Agents directory does not exist or cannot be read',
      );
      return agents;
    }

    return agents;
  }

  /**
   * Filter agents based on query parameters
   */
  private filterAgents(agents: Agent[], query: ListAgentsQuery): Agent[] {
    let filtered = agents;

    // Filter by type
    if (query.type && query.type !== 'all') {
      filtered = filtered.filter((agent) => agent.type === query.type);
    }

    // Filter by search term (case-insensitive search in name and description)
    if (query.search) {
      const searchTerm = query.search.toLowerCase();
      filtered = filtered.filter(
        (agent) =>
          agent.name.toLowerCase().includes(searchTerm) ||
          agent.description.toLowerCase().includes(searchTerm),
      );
    }

    return filtered;
  }

  /**
   * List all available agents from both user and project directories
   */
  async listAgents(params: {
    sessionId: string;
    projectPath: string;
    query: ListAgentsQuery;
  }): Promise<ListAgentsResponse> {
    const { sessionId, projectPath, query } = params;

    logger.debug(
      {
        sessionId,
        projectPath,
        query,
      },
      'Listing agents',
    );

    // Validate project path
    if (!projectPath || !isAbsolute(projectPath)) {
      throw new ValidationError('Invalid project path');
    }

    const claudeHomePath = this.getClaudeHomePath();
    const userAgentsPath = this.getAgentsDirectoryPath(claudeHomePath, true);
    const projectAgentsPath = this.getAgentsDirectoryPath(projectPath, false);

    const allAgents: Agent[] = [];

    // Check if user agents directory exists and read agents
    if (await directoryExists(userAgentsPath)) {
      const userAgents = await this.readAgentsFromDirectory(userAgentsPath, 'user');
      allAgents.push(...userAgents);
      logger.debug(
        {
          userAgentsPath,
          count: userAgents.length,
        },
        'Found user agents',
      );
    } else {
      logger.debug(
        {
          userAgentsPath,
        },
        'User agents directory not found',
      );
    }

    // Check if project agents directory exists and read agents
    if (await directoryExists(projectAgentsPath)) {
      const projectAgents = await this.readAgentsFromDirectory(projectAgentsPath, 'project');
      allAgents.push(...projectAgents);
      logger.debug(
        {
          projectAgentsPath,
          count: projectAgents.length,
        },
        'Found project agents',
      );
    } else {
      logger.debug(
        {
          projectAgentsPath,
        },
        'Project agents directory not found',
      );
    }

    // Filter agents based on query
    const filteredAgents = this.filterAgents(allAgents, query);

    logger.info(
      {
        sessionId,
        totalAgents: allAgents.length,
        filteredAgents: filteredAgents.length,
        userAgentsPath,
        projectAgentsPath,
      },
      'Successfully listed agents',
    );

    const sources: {
      userAgentsPath?: string;
      projectAgentsPath?: string;
    } = {};

    if (await directoryExists(userAgentsPath)) {
      sources.userAgentsPath = userAgentsPath;
    }

    if (await directoryExists(projectAgentsPath)) {
      sources.projectAgentsPath = projectAgentsPath;
    }

    return {
      agents: filteredAgents,
      sources,
    };
  }
}

// Export singleton instance
export const agentService = new AgentService();
