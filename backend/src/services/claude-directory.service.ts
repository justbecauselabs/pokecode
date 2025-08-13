import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileService } from '@/services/file.service';
import type { IntermediateMessage } from '../types/claude-messages';
import { logger } from '../utils/logger';
import { parseJsonlMessage, toIntermediateMessage } from '../utils/message-validator';

// TODO: Add 'better-sqlite3' dependency to package.json for SQLite access
// For now, we'll focus on JSONL file access which is the primary storage format

/**
 * Service for interfacing with Claude Code CLI's local storage directory (~/.claude)
 * Provides access to conversation data stored in SQLite + JSONL format
 */
export class ClaudeDirectoryService {
  private claudeBasePath: string;
  private sqliteDbPath: string;
  private projectsPath: string;
  private sessionSpecificPath?: string; // For session-isolated directories

  constructor(claudeDirectoryPath?: string) {
    this.claudeBasePath = claudeDirectoryPath || join(homedir(), '.claude');
    this.sqliteDbPath = join(this.claudeBasePath, '__store.db');
    this.projectsPath = join(this.claudeBasePath, 'projects');

    logger.debug(
      {
        claudeBasePath: this.claudeBasePath,
        sqliteDbPath: this.sqliteDbPath,
        projectsPath: this.projectsPath,
      },
      'ClaudeDirectoryService initialized',
    );
  }

  /**
   * Create a service instance for a specific session directory
   * Used for session-isolated conversation storage
   */
  static forSessionDirectory(sessionDirectoryPath: string): ClaudeDirectoryService {
    const service = new ClaudeDirectoryService();
    service.sessionSpecificPath = sessionDirectoryPath;

    logger.debug(
      {
        sessionSpecificPath: sessionDirectoryPath,
      },
      'ClaudeDirectoryService initialized for session-specific directory',
    );

    return service;
  }

  /**
   * Check if Claude directory exists and is initialized using File Service
   */
  async isInitialized(): Promise<boolean> {
    try {
      // Check if claude base path exists
      await fileService.listFiles('system', '/', this.claudeBasePath, { recursive: false });
      const claudeExists = true;

      // Check if sqlite database exists
      let sqliteExists = false;
      try {
        await fileService.readFile('system', '/', this.sqliteDbPath);
        sqliteExists = true;
      } catch {
        sqliteExists = false;
      }

      const isInitialized = claudeExists && sqliteExists;

      logger.debug(
        {
          claudeBasePath: this.claudeBasePath,
          claudeExists,
          sqliteDbPath: this.sqliteDbPath,
          sqliteExists,
          isInitialized,
        },
        'Claude directory initialization check',
      );

      return isInitialized;
    } catch {
      return false;
    }
  }

  /**
   * Initialize Claude directory structure if it doesn't exist using File Service
   */
  async ensureInitialized(): Promise<void> {
    try {
      // Check if claude base path exists, if not create it
      await fileService.listFiles('system', '/', this.claudeBasePath, { recursive: false });
    } catch {
      // Directory doesn't exist, create placeholder file to ensure directory structure
      await fileService.createFile('system', '/', join(this.claudeBasePath, '.keep'), '');
    }

    try {
      // Check if projects path exists, if not create it
      await fileService.listFiles('system', '/', this.projectsPath, { recursive: false });
    } catch {
      // Directory doesn't exist, create placeholder file to ensure directory structure
      await fileService.createFile('system', '/', join(this.projectsPath, '.keep'), '');
    }
  }

  /**
   * Get project-based conversation files (JSONL format) using File Service
   */
  async getProjectConversationFiles(projectPath: string): Promise<string[]> {
    try {
      // Use session-specific path if available, otherwise fall back to original behavior
      let projectDir: string;
      if (this.sessionSpecificPath) {
        projectDir = this.sessionSpecificPath;
      } else {
        const projectKey = projectPath.replace(/\//g, '-');
        projectDir = join(this.projectsPath, projectKey);
      }

      logger.debug(
        {
          projectPath,
          projectDir,
          sessionSpecificPath: this.sessionSpecificPath,
          usingSessionSpecific: !!this.sessionSpecificPath,
        },
        'Getting project conversation files',
      );

      try {
        const { files } = await fileService.listFiles('system', '/', projectDir, {
          recursive: false,
          pattern: '*.jsonl',
        });

        const fullPaths = files
          .filter((file) => file.type === 'file')
          .map((file) => join(projectDir, file.name));

        logger.debug(
          {
            projectDir,
            allFiles: files.map((f) => f.name),
            jsonlFiles: files.filter((f) => f.name.endsWith('.jsonl')).map((f) => f.name),
            fullPaths,
            count: fullPaths.length,
          },
          'Found project conversation files',
        );

        return fullPaths;
      } catch {
        logger.debug(
          {
            projectDir,
            exists: false,
          },
          'Project directory does not exist',
        );
        return [];
      }
    } catch (error) {
      logger.error(
        {
          projectPath,
          error: error instanceof Error ? error.message : String(error),
        },
        'Error reading project conversation files',
      );
      return [];
    }
  }

  /**
   * Read JSONL conversation file with Zod validation using File Service
   */
  async readConversationFile(filePath: string): Promise<IntermediateMessage[]> {
    try {
      logger.debug(
        {
          filePath,
        },
        'Reading conversation file with validation',
      );

      let content: string;
      try {
        const fileResponse = await fileService.readFile('system', '/', filePath);
        content = fileResponse.content;
      } catch {
        logger.debug({ filePath }, 'Conversation file does not exist');
        return [];
      }

      const lines = content
        .trim()
        .split('\n')
        .filter((line) => line.trim());

      logger.debug(
        {
          filePath,
          contentLength: content.length,
          totalLines: lines.length,
          contentPreview: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
        },
        'Read conversation file content',
      );

      const intermediateMessages: IntermediateMessage[] = [];

      for (const [index, line] of lines.entries()) {
        try {
          const parsed = JSON.parse(line);

          // Strict validation - will throw on invalid messages
          const validatedMessage = parseJsonlMessage(parsed, index, filePath);

          // Convert to intermediate message format
          const intermediateMessage = toIntermediateMessage(validatedMessage);
          intermediateMessages.push(intermediateMessage);
        } catch (jsonError) {
          if (jsonError instanceof SyntaxError) {
            logger.error(
              {
                filePath,
                lineIndex: index,
                line: line.substring(0, 100) + (line.length > 100 ? '...' : ''),
                error: jsonError.message,
              },
              'JSON parsing error in JSONL file',
            );
            throw new Error(
              `JSON parsing error at line ${index} in ${filePath}: ${jsonError.message}`,
            );
          }
          // Re-throw validation errors from MessageValidator
          throw jsonError;
        }
      }

      logger.debug(
        {
          filePath,
          totalMessages: intermediateMessages.length,
          messageTypes: intermediateMessages.map((m) => m.type),
        },
        'Successfully processed conversation file with strict validation',
      );

      return intermediateMessages;
    } catch (error) {
      logger.error(
        {
          filePath,
          error: error instanceof Error ? error.message : String(error),
        },
        'Error reading conversation file - strict validation failed',
      );

      // Re-throw the error instead of returning empty array
      throw error instanceof Error
        ? error
        : new Error(`Failed to read conversation file ${filePath}: ${String(error)}`);
    }
  }

  /**
   * Get all conversations for a project path
   * Currently focuses on JSONL files, SQLite support coming later
   */
  async getProjectConversations(projectPath: string): Promise<{
    jsonlConversations: Array<{
      file: string;
      messages: IntermediateMessage[];
    }>;
  }> {
    logger.debug({ projectPath }, 'Getting project conversations');

    const jsonlFiles = await this.getProjectConversationFiles(projectPath);
    const jsonlConversations: Array<{
      file: string;
      messages: IntermediateMessage[];
    }> = [];

    for (const file of jsonlFiles) {
      try {
        const messages = await this.readConversationFile(file);
        jsonlConversations.push({
          file,
          messages,
        });
      } catch (error) {
        logger.error(
          {
            projectPath,
            file,
            error: error instanceof Error ? error.message : String(error),
          },
          'Skipping conversation file due to validation error',
        );
      }
    }

    logger.debug(
      {
        projectPath,
        fileCount: jsonlFiles.length,
        conversationsWithMessages: jsonlConversations.filter((c) => c.messages.length > 0).length,
        totalMessages: jsonlConversations.reduce((sum, c) => sum + c.messages.length, 0),
      },
      'Retrieved project conversations',
    );

    return {
      jsonlConversations,
    };
  }

  /**
   * Group conversation messages into threads and categorize them
   * Returns user prompts, final responses, and intermediate messages
   */
  async getConversationThreads(projectPath: string): Promise<{
    conversationThreads: Array<{
      userPrompt: IntermediateMessage;
      finalResponse: IntermediateMessage | null;
      intermediateMessages: IntermediateMessage[];
      threadId: string;
    }>;
  }> {
    logger.debug({ projectPath }, 'Getting conversation threads');

    const conversations = await this.getProjectConversations(projectPath);
    const conversationThreads: Array<{
      userPrompt: IntermediateMessage;
      finalResponse: IntermediateMessage | null;
      intermediateMessages: IntermediateMessage[];
      threadId: string;
    }> = [];

    for (const jsonlConv of conversations.jsonlConversations) {
      const messages = jsonlConv.messages;
      const messageMap = new Map<string, IntermediateMessage>();

      // Create a map of id -> message for easy lookup
      for (const message of messages) {
        messageMap.set(message.id, message);
      }

      // Find user prompts (messages with no parent and role: "user")
      const userPrompts = messages.filter(
        (msg) => !msg.metadata?.parentUuid && msg.role === 'user',
      );

      for (const userPrompt of userPrompts) {
        const thread = {
          userPrompt,
          finalResponse: null as IntermediateMessage | null,
          intermediateMessages: [] as IntermediateMessage[],
          threadId: userPrompt.id,
        };

        // Traverse the conversation chain to find all related messages
        const visited = new Set<string>();
        const queue = [userPrompt.id];
        const threadMessages: IntermediateMessage[] = [];

        while (queue.length > 0) {
          const currentId = queue.shift();
          if (!currentId || visited.has(currentId)) {
            continue;
          }
          visited.add(currentId);

          // Find all messages that have this id as their parent
          const children = messages.filter((msg) => msg.metadata?.parentUuid === currentId);

          for (const child of children) {
            threadMessages.push(child);
            queue.push(child.id);
          }
        }

        // Sort thread messages by timestamp
        threadMessages.sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );

        // Categorize messages: find the final response (last substantial assistant message)
        let finalResponse = null;
        const intermediateMessages = [];

        for (let i = threadMessages.length - 1; i >= 0; i--) {
          const msg = threadMessages[i];
          if (!msg) continue;

          if (msg.role === 'assistant' && !finalResponse) {
            // Check if this is a substantial final response (more than 50 characters)
            if (msg.content && msg.content.length > 50) {
              finalResponse = msg;
              continue;
            }
          }

          intermediateMessages.unshift(msg);
        }

        thread.finalResponse = finalResponse;
        thread.intermediateMessages = intermediateMessages;

        conversationThreads.push(thread);
      }
    }

    logger.debug(
      {
        projectPath,
        threadCount: conversationThreads.length,
        threadsWithFinalResponse: conversationThreads.filter((t) => t.finalResponse).length,
      },
      'Retrieved conversation threads',
    );

    return { conversationThreads };
  }

  /**
   * Get intermediate messages for a specific conversation thread
   */
  async getIntermediateMessages(
    projectPath: string,
    threadId: string,
  ): Promise<IntermediateMessage[]> {
    const threads = await this.getConversationThreads(projectPath);
    const thread = threads.conversationThreads.find((t) => t.threadId === threadId);

    if (!thread) {
      logger.warn({ projectPath, threadId }, 'Thread not found');
      return [];
    }

    return thread.intermediateMessages;
  }

  /**
   * Get conversation history for export/display
   * Currently works with JSONL files, will be enhanced with SQLite support
   */
  async getConversationHistory(filePath: string): Promise<{
    messages: IntermediateMessage[];
    summary: {
      totalMessages: number;
    };
  }> {
    try {
      const messages = await this.readConversationFile(filePath);

      return {
        messages,
        summary: {
          totalMessages: messages.length,
        },
      };
    } catch (error) {
      logger.error(
        {
          filePath,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to get conversation history due to validation error',
      );
      throw error;
    }
  }

  /**
   * Create a mapping between project paths and Claude directory paths
   * Now supports session-specific isolation to prevent history cross-contamination
   */
  static getClaudeDirectoryPath(
    projectPath: string,
    sessionId?: string,
    claudeBasePath?: string,
  ): string {
    const basePath = claudeBasePath || join(homedir(), '.claude');

    // Claude CLI organizes projects by path, replacing slashes with dashes and underscores with hyphens
    const projectKey = projectPath.replace(/\//g, '-').replace(/_/g, '-');

    // If sessionId is provided, create session-specific directory for isolation
    if (sessionId) {
      return join(basePath, 'projects', projectKey, sessionId);
    }

    // Fallback to original behavior for backward compatibility
    return join(basePath, 'projects', projectKey);
  }

  /**
   * Export session history to specified format
   */
  async exportSessionHistory(
    projectPath: string,
    format: 'markdown' | 'json' = 'markdown',
  ): Promise<{
    content: string;
    format: string;
  }> {
    try {
      const conversations = await this.getProjectConversations(projectPath);

      if (format === 'json') {
        return {
          content: JSON.stringify(conversations, null, 2),
          format: 'json',
        };
      }

      // Generate markdown format
      let markdown = `# Session History\n\n**Project:** ${projectPath}\n\n`;

      for (const jsonlConv of conversations.jsonlConversations) {
        if (jsonlConv.messages.length > 0) {
          markdown += `## Conversation from ${jsonlConv.file}\n\n`;

          for (const message of jsonlConv.messages) {
            const role =
              message.role === 'user'
                ? 'User'
                : message.role === 'assistant'
                  ? 'Assistant'
                  : 'System';
            markdown += `### ${role}\n\n${message.content}\n\n`;
          }
        }
      }

      return {
        content: markdown,
        format: 'markdown',
      };
    } catch (error) {
      console.error('Error exporting session history:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: `# Export Error\n\nFailed to export session history: ${errorMessage}`,
        format: 'markdown',
      };
    }
  }

  /**
   * Find the most recent conversation for a project
   */
  async getMostRecentConversation(projectPath: string): Promise<{
    conversationId?: string;
    source: 'jsonl';
    lastActivity: string;
  } | null> {
    try {
      const { jsonlConversations } = await this.getProjectConversations(projectPath);

      let mostRecent = null;
      let lastActivity = '';

      // Check JSONL conversations for most recent activity
      for (const jsonlConv of jsonlConversations) {
        if (jsonlConv.messages.length > 0) {
          const lastMessage = jsonlConv.messages[jsonlConv.messages.length - 1];
          if (lastMessage && (!lastActivity || lastMessage.timestamp > lastActivity)) {
            mostRecent = {
              conversationId: jsonlConv.file,
              source: 'jsonl' as const,
              lastActivity: lastMessage.timestamp,
            };
            lastActivity = lastMessage.timestamp;
          }
        }
      }

      return mostRecent;
    } catch (error) {
      console.error('Error finding most recent conversation:', error);
      return null;
    }
  }
}

export default ClaudeDirectoryService;
