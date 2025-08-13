import { homedir } from 'node:os';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { Agent, ListAgentsQuery, ListAgentsResponse } from '@/schemas/agent.schema';
import { ValidationError } from '@/types';
import { logger } from '@/utils/logger';

interface AgentFrontMatter {
  name?: string;
  description?: string;
  color?: string;
}

/**
 * Service for discovering and managing agents from Claude home and project directories
 */
export class AgentService {
  /**
   * Get the Claude home directory path
   */
  private getClaudeHomePath(): string {
    return path.join(homedir(), '.claude');
  }

  /**
   * Get agents directory path for a given base path
   */
  private getAgentsDirectoryPath(basePath: string): string {
    return path.join(basePath, 'agents');
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
   * Parse YAML frontmatter from markdown content
   */
  private parseFrontMatter(content: string): { frontMatter: AgentFrontMatter; content: string } {
    const frontMatterMatch = content.match(/^---\s*\n(.*?)\n---\s*\n(.*)/s);

    if (!frontMatterMatch) {
      // No frontmatter found, return empty frontmatter and full content
      return {
        frontMatter: {},
        content: content.trim(),
      };
    }

    try {
      const frontMatterYaml = frontMatterMatch[1];
      const mainContent = frontMatterMatch[2];

      if (!frontMatterYaml || !mainContent) {
        return {
          frontMatter: {},
          content: content.trim(),
        };
      }

      const frontMatter = parseYaml(frontMatterYaml) as AgentFrontMatter;

      return {
        frontMatter: frontMatter || {},
        content: mainContent.trim(),
      };
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to parse YAML frontmatter, using empty frontmatter',
      );

      return {
        frontMatter: {},
        content: content.trim(),
      };
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
      // Use Bun.Glob to find all .md files in the directory
      const glob = new Bun.Glob('*.md');
      const files = Array.from(glob.scanSync({ cwd: agentsPath }));

      for (const fileName of files) {
        const fullPath = path.join(agentsPath, fileName);
        const agentFileName = fileName.slice(0, -3); // Remove .md extension

        try {
          const file = Bun.file(fullPath);
          const rawContent = await file.text();
          const { frontMatter, content } = this.parseFrontMatter(rawContent);

          // Use name from frontmatter if available, otherwise use filename
          const agentName = frontMatter.name || agentFileName;
          const agentDescription = frontMatter.description || '';

          if (!agentDescription) {
            logger.warn(
              {
                agentName,
                agentType,
                path: fullPath,
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
          if (frontMatter.color) {
            agent.color = frontMatter.color;
          }

          agents.push(agent);

          logger.debug(
            {
              agentName,
              agentType,
              path: fullPath,
              contentLength: content.length,
              hasDescription: !!agentDescription,
              hasColor: !!frontMatter.color,
            },
            'Successfully read agent file',
          );
        } catch (error) {
          logger.warn(
            {
              agentFileName,
              agentType,
              path: fullPath,
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
    if (!projectPath || !path.isAbsolute(projectPath)) {
      throw new ValidationError('Invalid project path');
    }

    const claudeHomePath = this.getClaudeHomePath();
    const userAgentsPath = this.getAgentsDirectoryPath(claudeHomePath);
    const projectAgentsPath = this.getAgentsDirectoryPath(projectPath);

    const allAgents: Agent[] = [];

    // Check if user agents directory exists and read agents
    if (await this.directoryExists(userAgentsPath)) {
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
    if (await this.directoryExists(projectAgentsPath)) {
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

    if (await this.directoryExists(userAgentsPath)) {
      sources.userAgentsPath = userAgentsPath;
    }

    if (await this.directoryExists(projectAgentsPath)) {
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
