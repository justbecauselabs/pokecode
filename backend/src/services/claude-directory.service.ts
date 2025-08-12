import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { logger } from '../utils/logger';

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
   * Read JSONL conversation file
   */
  readConversationFile(filePath: string): Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    metadata?: any;
  }> {
    try {
      logger.debug(
        {
          filePath,
          exists: existsSync(filePath),
        },
        'Reading conversation file',
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

      const messages = lines
        .map((line, index) => {
          try {
            const parsed = JSON.parse(line);
            logger.debug(
              {
                filePath,
                lineIndex: index,
                parsedKeys: Object.keys(parsed),
                role: parsed.role,
                hasContent: !!parsed.content,
                contentLength: parsed.content?.length || 0,
              },
              'Parsed JSONL line',
            );
            return parsed;
          } catch (error) {
            logger.error(
              {
                filePath,
                lineIndex: index,
                line: line.substring(0, 100) + (line.length > 100 ? '...' : ''),
                error: error instanceof Error ? error.message : String(error),
              },
              'Error parsing JSONL line',
            );
            return null;
          }
        })
        .filter(Boolean);

      logger.debug(
        {
          filePath,
          totalMessages: messages.length,
          messageTypes: messages.map((m) => m.role),
        },
        'Finished reading conversation file',
      );

      return messages;
    } catch (error) {
      logger.error(
        {
          filePath,
          error: error instanceof Error ? error.message : String(error),
        },
        'Error reading conversation file',
      );
      return [];
    }
  }

  /**
   * Get all conversations for a project path
   * Currently focuses on JSONL files, SQLite support coming later
   */
  getProjectConversations(projectPath: string): {
    jsonlConversations: Array<any>;
  } {
    logger.debug({ projectPath }, 'Getting project conversations');

    const jsonlFiles = this.getProjectConversationFiles(projectPath);
    const jsonlConversations = jsonlFiles.map((file) => {
      const messages = this.readConversationFile(file);
      return {
        file,
        messages,
      };
    });

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
      userPrompt: any;
      finalResponse: any | null;
      intermediateMessages: any[];
      threadId: string;
    }>;
  } {
    logger.debug({ projectPath }, 'Getting conversation threads');

    const conversations = this.getProjectConversations(projectPath);
    const conversationThreads: Array<{
      userPrompt: any;
      finalResponse: any | null;
      intermediateMessages: any[];
      threadId: string;
    }> = [];

    for (const jsonlConv of conversations.jsonlConversations) {
      const messages = jsonlConv.messages;
      const messageMap = new Map();

      // Create a map of uuid -> message for easy lookup
      for (const message of messages) {
        messageMap.set(message.uuid, message);
      }

      // Find user prompts (messages with parentUuid: null and type: "user")
      const userPrompts = messages.filter(
        (msg: any) => msg.parentUuid === null && msg.type === 'user',
      );

      for (const userPrompt of userPrompts) {
        const thread = {
          userPrompt,
          finalResponse: null as any,
          intermediateMessages: [] as any[],
          threadId: userPrompt.uuid,
        };

        // Traverse the conversation chain to find all related messages
        const visited = new Set();
        const queue = [userPrompt.uuid];
        const threadMessages: any[] = [];

        while (queue.length > 0) {
          const currentUuid = queue.shift();
          if (!currentUuid || visited.has(currentUuid)) {
            continue;
          }
          visited.add(currentUuid);

          // Find all messages that have this uuid as their parentUuid
          const children = messages.filter((msg: any) => msg.parentUuid === currentUuid);

          for (const child of children) {
            threadMessages.push(child);
            queue.push(child.uuid);
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

          if (msg.type === 'assistant' && !finalResponse) {
            // Check if this is a substantial final response
            const hasTextContent =
              msg.message?.content?.some?.(
                (content: any) =>
                  content.type === 'text' && content.text && content.text.length > 50,
              ) ||
              (typeof msg.message?.content === 'string' && msg.message.content.length > 50);

            if (hasTextContent) {
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
  getIntermediateMessages(projectPath: string, threadId: string): any[] {
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
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
      metadata?: any;
    }>;
    summary: {
      totalMessages: number;
    };
  } {
    const messages = this.readConversationFile(filePath);

    return {
      messages,
      summary: {
        totalMessages: messages.length,
      },
    };
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
            const role = message.role === 'user' ? 'User' : 'Assistant';
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
          if (!lastActivity || lastMessage.timestamp > lastActivity) {
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
