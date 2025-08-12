import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { IntermediateMessage } from '../types/claude-messages';
import { logger } from '../utils/logger';
import { MessageValidator } from '../utils/message-validator';

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
   * Check if Claude directory exists and is initialized
   */
  isInitialized(): boolean {
    const claudeExists = existsSync(this.claudeBasePath);
    const sqliteExists = existsSync(this.sqliteDbPath);
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
  }

  /**
   * Initialize Claude directory structure if it doesn't exist
   */
  ensureInitialized(): void {
    if (!existsSync(this.claudeBasePath)) {
      mkdirSync(this.claudeBasePath, { recursive: true });
    }
    if (!existsSync(this.projectsPath)) {
      mkdirSync(this.projectsPath, { recursive: true });
    }
  }

  // SQLite methods commented out until better-sqlite3 dependency is added
  // TODO: Uncomment and implement SQLite methods once better-sqlite3 is added to dependencies

  /*
  private getDatabase(): Database.Database {
    if (!existsSync(this.sqliteDbPath)) {
      throw new Error(`Claude SQLite database not found at ${this.sqliteDbPath}`);
    }
    return new Database(this.sqliteDbPath, { readonly: true });
  }

  getConversationSessions(): Array<{
    id: string;
    working_directory?: string;
    created_at: string;
    updated_at: string;
  }> {
    // Implementation using SQLite queries
  }

  getConversationMessages(conversationId: string): Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
    metadata?: any;
  }> {
    // Implementation using SQLite queries  
  }

  getConversationByWorkingDirectory(workingDirectory: string): Array<{
    id: string;
    working_directory?: string;
    created_at: string;
  }> {
    // Implementation using SQLite queries
  }
  */

  /**
   * Get project-based conversation files (JSONL format)
   */
  getProjectConversationFiles(projectPath: string): string[] {
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

      if (!existsSync(projectDir)) {
        logger.debug(
          {
            projectDir,
            exists: false,
          },
          'Project directory does not exist',
        );
        return [];
      }

      const fs = require('node:fs');
      const files = fs.readdirSync(projectDir);
      const jsonlFiles = files.filter((file: string) => file.endsWith('.jsonl'));
      const fullPaths = jsonlFiles.map((file: string) => join(projectDir, file));

      logger.debug(
        {
          projectDir,
          allFiles: files,
          jsonlFiles,
          fullPaths,
          count: fullPaths.length,
        },
        'Found project conversation files',
      );

      return fullPaths;
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
   * Read JSONL conversation file with Zod validation
   */
  readConversationFile(filePath: string): IntermediateMessage[] {
    try {
      logger.debug(
        {
          filePath,
          exists: existsSync(filePath),
        },
        'Reading conversation file with validation',
      );

      if (!existsSync(filePath)) {
        logger.debug({ filePath }, 'Conversation file does not exist');
        return [];
      }

      const content = readFileSync(filePath, 'utf-8');
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
          const validatedMessage = MessageValidator.parseJsonlMessage(parsed, index, filePath);

          // Convert to intermediate message format
          const intermediateMessage = MessageValidator.toIntermediateMessage(validatedMessage);
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
  getProjectConversations(projectPath: string): {
    jsonlConversations: Array<{
      file: string;
      messages: IntermediateMessage[];
    }>;
  } {
    logger.debug({ projectPath }, 'Getting project conversations');

    const jsonlFiles = this.getProjectConversationFiles(projectPath);
    const jsonlConversations: Array<{
      file: string;
      messages: IntermediateMessage[];
    }> = [];

    for (const file of jsonlFiles) {
      try {
        const messages = this.readConversationFile(file);
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
        // Skip invalid files but continue processing others
        continue;
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
  getConversationThreads(projectPath: string): {
    conversationThreads: Array<{
      userPrompt: IntermediateMessage;
      finalResponse: IntermediateMessage | null;
      intermediateMessages: IntermediateMessage[];
      threadId: string;
    }>;
  } {
    logger.debug({ projectPath }, 'Getting conversation threads');

    const conversations = this.getProjectConversations(projectPath);
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
  getIntermediateMessages(projectPath: string, threadId: string): IntermediateMessage[] {
    const threads = this.getConversationThreads(projectPath);
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
  getConversationHistory(filePath: string): {
    messages: IntermediateMessage[];
    summary: {
      totalMessages: number;
    };
  } {
    try {
      const messages = this.readConversationFile(filePath);

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
  exportSessionHistory(
    projectPath: string,
    format: 'markdown' | 'json' = 'markdown',
  ): {
    content: string;
    format: string;
  } {
    try {
      const conversations = this.getProjectConversations(projectPath);

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
  getMostRecentConversation(projectPath: string): {
    conversationId?: string;
    source: 'jsonl';
    lastActivity: string;
  } | null {
    try {
      const { jsonlConversations } = this.getProjectConversations(projectPath);

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
