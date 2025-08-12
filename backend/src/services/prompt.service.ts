import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { sessions } from '@/db/schema';
import { NotFoundError } from '@/types';
import { logger } from '@/utils/logger';
import ClaudeDirectoryService from './claude-directory.service';
import { messageService } from './message.service';
import { queueService } from './queue.service';

/**
 * Prompt Service - Handles prompt execution and history
 *
 * Since prompts are now stored in Claude directory (SQLite + JSONL files),
 * this service focuses on job management and history retrieval from Claude directory.
 */
export class PromptService {
  /**
   * Extract content from a Claude directory message
   * @private
   */
  private extractContentFromMessage(msg: any): string {
    let content = '';

    if (msg.message) {
      if (msg.message.content) {
        if (typeof msg.message.content === 'string') {
          content = msg.message.content;
        } else if (Array.isArray(msg.message.content)) {
          // Handle assistant messages with content array
          content = msg.message.content
            .map((item: any) => {
              if (item.type === 'text') {
                return item.text;
              }
              if (item.type === 'tool_use') {
                return `[Tool: ${item.name}]`;
              }
              return '';
            })
            .filter(Boolean)
            .join(' ');
        }
      }
      // Handle tool use results
      if (msg.toolUseResult) {
        content += content
          ? `\n\n[Tool Result]\n${msg.toolUseResult}`
          : `[Tool Result]\n${msg.toolUseResult}`;
      }
    }

    return content;
  }

  /**
   * Create and execute a new prompt
   */
  async createPrompt(
    sessionId: string,
    data: {
      prompt: string;
      allowedTools?: string[];
    },
  ) {
    // Verify session exists
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    // Create user message record
    const userMessage = await messageService.createMessage({
      sessionId,
      text: data.prompt,
      type: 'user',
    });

    // Generate a unique job ID for this prompt
    const jobId = crypto.randomUUID();

    // Add to queue for processing, passing the message ID
    await queueService.addPromptJob(
      sessionId,
      jobId, // Use jobId instead of prompt record ID
      data.prompt,
      data.allowedTools || session.metadata?.allowedTools,
      userMessage.id, // Pass message ID to worker
    );

    // Update session working state and last accessed time
    await db
      .update(sessions)
      .set({
        lastAccessedAt: new Date(),
        isWorking: true,
        currentJobId: jobId,
        lastJobStatus: 'queued',
      })
      .where(eq(sessions.id, sessionId));

    // Return the created message along with job info
    return {
      success: true,
      message: 'Prompt queued successfully',
      jobId,
      userMessage,
    };
  }

  /**
   * Get prompt history for a session from Claude directory
   */
  async getPromptHistory(
    sessionId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {},
  ) {
    logger.debug(
      {
        sessionId,
        options,
      },
      'Getting prompt history',
    );

    // Verify session exists
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      logger.debug({ sessionId }, 'Session not found for prompt history');
      throw new NotFoundError('Session');
    }

    // 1) If the DB session does not have a claudeCodeSessionId, return empty array
    if (!session.claudeCodeSessionId) {
      logger.debug(
        {
          sessionId,
          claudeCodeSessionId: session.claudeCodeSessionId,
        },
        'No Claude Code session ID found, returning empty array',
      );
      return {
        data: [],
        pagination: {
          total: 0,
          limit: options.limit || 50,
          offset: options.offset || 0,
          hasMore: false,
        },
      };
    }

    logger.debug(
      {
        sessionId,
        projectPath: session.projectPath,
        claudeCodeSessionId: session.claudeCodeSessionId,
      },
      'Found session with Claude Code session ID',
    );

    const { limit = 50, offset = 0 } = options;

    try {
      // Validate required session data
      if (!session.projectPath) {
        throw new Error('Session does not have project path configured');
      }

      // 2) If DB has a claudeCodeSessionId, load the JSONL file from correct path
      const claudeService = new ClaudeDirectoryService();
      const projectDir = ClaudeDirectoryService.getClaudeDirectoryPath(session.projectPath);
      const jsonlFilePath = `${projectDir}/${session.claudeCodeSessionId}.jsonl`;

      logger.debug(
        {
          sessionId,
          claudeCodeSessionId: session.claudeCodeSessionId,
          projectDir,
          jsonlFilePath,
        },
        'Attempting to load specific Claude Code session file',
      );

      // Read the specific JSONL file for this Claude Code session
      const messages = claudeService.readConversationFile(jsonlFilePath);

      if (messages.length === 0) {
        logger.debug(
          {
            sessionId,
            claudeCodeSessionId: session.claudeCodeSessionId,
            jsonlFilePath,
          },
          'No messages found in Claude Code session file',
        );
        return {
          data: [],
          pagination: {
            total: 0,
            limit,
            offset,
            hasMore: false,
          },
        };
      }

      logger.debug(
        {
          sessionId,
          claudeCodeSessionId: session.claudeCodeSessionId,
          messageCount: messages.length,
        },
        'Loaded messages from Claude Code session file',
      );

      // 3) Process messages and return format with nested parent-child relationships
      const processedMessages = this.buildNestedMessageStructure(messages);

      // Sort by timestamp descending (most recent first)
      processedMessages.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      // Apply pagination
      const paginatedMessages = processedMessages.slice(offset, offset + limit);

      logger.debug(
        {
          sessionId,
          totalMessages: processedMessages.length,
          returnedMessages: paginatedMessages.length,
          limit,
          offset,
        },
        'Returning processed prompt history with nested structure',
      );

      return {
        data: paginatedMessages,
        pagination: {
          total: processedMessages.length,
          limit,
          offset,
          hasMore: offset + limit < processedMessages.length,
        },
      };
    } catch (error) {
      logger.error(
        {
          sessionId,
          claudeCodeSessionId: session.claudeCodeSessionId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Error loading conversation history from Claude directory',
      );

      // Return empty history on error
      return {
        data: [],
        pagination: {
          total: 0,
          limit,
          offset,
          hasMore: false,
        },
      };
    }
  }

  /**
   * Check if a message is a tool result (not a user prompt)
   * @private
   */
  private isToolResult(msg: any): boolean {
    // Tool results have type 'user' but contain tool_result content
    if (msg.message?.content && Array.isArray(msg.message.content)) {
      return msg.message.content.some((c: any) => c.type === 'tool_result');
    }
    if (msg.message?.content && Array.isArray(msg.message.content)) {
      return msg.message.content.some((c: any) => c.tool_use_id);
    }
    // Also check for toolUseResult property
    return !!msg.toolUseResult;
  }

  /**
   * Build nested message structure based on parentUuid relationships
   * @private
   */
  private buildNestedMessageStructure(messages: any[]): any[] {
    const userPrompts: any[] = [];
    const messageMap = new Map();

    // First pass: create map and collect all user prompts
    for (const msg of messages) {
      messageMap.set(msg.uuid, msg);

      // Collect ALL user prompts (both root and follow-up)
      // But exclude tool results which have type 'user' but contain tool_result content
      if (msg.type === 'user' && !this.isToolResult(msg)) {
        userPrompts.push(msg);
      }
    }

    logger.debug(
      {
        totalMessages: messages.length,
        userPrompts: userPrompts.length,
        userPromptUuids: userPrompts.map((p) => p.uuid),
        userPromptParents: userPrompts.map((p) => ({ uuid: p.uuid, parentUuid: p.parentUuid })),
      },
      'Collected user prompts for processing',
    );

    // Second pass: for each user prompt, find its response and intermediate messages
    const processedPrompts = userPrompts.map((userPrompt) => {
      const intermediateMessages: any[] = [];
      let finalResponse: any = null;

      // Find the conversation thread starting from this user prompt
      const visited = new Set();
      const queue = [userPrompt.uuid];

      logger.debug(
        {
          userPromptUuid: userPrompt.uuid,
          userPromptContent: userPrompt.message?.content,
        },
        'Processing user prompt for thread analysis',
      );

      while (queue.length > 0) {
        const currentUuid = queue.shift();
        if (!currentUuid || visited.has(currentUuid)) {
          continue;
        }
        visited.add(currentUuid);

        // Find all messages that have this uuid as their parent
        const children = messages.filter((msg) => msg.parentUuid === currentUuid);

        logger.debug(
          {
            currentUuid,
            childrenCount: children.length,
            childrenTypes: children.map((c) => ({ uuid: c.uuid, type: c.type })),
          },
          'Found children for current message',
        );

        for (const child of children) {
          if (child.type === 'assistant') {
            // Check if this is a substantial final response
            const hasTextContent =
              child.message?.content?.some?.(
                (content: any) =>
                  content.type === 'text' && content.text && content.text.length > 50,
              ) ||
              (typeof child.message?.content === 'string' && child.message.content.length > 50);

            logger.debug(
              {
                childUuid: child.uuid,
                hasTextContent,
                contentPreview: JSON.stringify(child.message?.content).substring(0, 200),
              },
              'Processing assistant message',
            );

            if (hasTextContent) {
              finalResponse = child;
            } else {
              // Add as intermediate message (tool use, etc.)
              intermediateMessages.push({
                id: child.uuid,
                content: this.extractContentFromMessage(child),
                role: child.message?.role,
                type: child.type,
                timestamp: child.timestamp,
                metadata: {
                  uuid: child.uuid,
                  parentUuid: child.parentUuid,
                  isIntermediate: true,
                },
              });
            }
          } else if (child.type === 'user' && child.uuid !== userPrompt.uuid) {
            // Tool results and other user messages (like tool_result)
            if (this.isToolResult(child)) {
              // This is a tool result, add as intermediate
              intermediateMessages.push({
                id: child.uuid,
                content: this.extractContentFromMessage(child),
                role: child.message?.role,
                type: child.type,
                timestamp: child.timestamp,
                metadata: {
                  uuid: child.uuid,
                  parentUuid: child.parentUuid,
                  isIntermediate: true,
                  isToolResult: true,
                },
              });
            }
          }

          // Continue traversing the tree
          queue.push(child.uuid);
        }
      }

      logger.debug(
        {
          userPromptUuid: userPrompt.uuid,
          intermediateCount: intermediateMessages.length,
          hasFinalResponse: !!finalResponse,
          finalResponseUuid: finalResponse?.uuid,
        },
        'Completed thread analysis for user prompt',
      );

      return {
        id: userPrompt.uuid,
        prompt: this.extractContentFromMessage(userPrompt),
        response: finalResponse ? this.extractContentFromMessage(finalResponse) : undefined,
        status: 'completed',
        metadata: {
          type: userPrompt.type,
          role: userPrompt.message?.role,
          uuid: userPrompt.uuid,
          parentUuid: userPrompt.parentUuid,
          sessionId: userPrompt.sessionId,
          timestamp: userPrompt.timestamp,
        },
        createdAt: userPrompt.timestamp,
        completedAt: finalResponse ? finalResponse.timestamp : undefined,
        intermediateMessages,
      };
    });

    return processedPrompts;
  }

  /**
   * Get detailed session history with job status correlation
   */
  async getDetailedHistory(sessionId: string) {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    try {
      // Load conversation history from session-specific Claude directory
      if (!session.projectPath) {
        throw new Error('Session does not have project path configured');
      }
      if (!session.claudeDirectoryPath) {
        throw new Error('Session does not have Claude directory path configured');
      }
      const claudeService = ClaudeDirectoryService.forSessionDirectory(session.claudeDirectoryPath);
      const conversations = claudeService.getProjectConversations(session.projectPath);

      // Note: Without prompts table, we can't correlate with job statuses
      // Job status would need to come from Redis/BullMQ directly if needed

      // Collect all messages
      const allMessages: any[] = [];

      for (const jsonlConv of conversations.jsonlConversations) {
        const messages = jsonlConv.messages.map((msg: any, index: number) => ({
          id: `${jsonlConv.file}-${index}`,
          type: msg.type || 'message',
          content: msg.content,
          timestamp: msg.timestamp || jsonlConv.createdAt,
          metadata: msg.metadata || {},
        }));
        allMessages.push(...messages);
      }

      // Sort chronologically
      allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return {
        session: {
          id: session.id,
          projectPath: session.projectPath,
          claudeDirectoryPath: session.claudeDirectoryPath,
          status: session.status,
          createdAt: session.createdAt,
          lastAccessedAt: session.lastAccessedAt,
        },
        messages: allMessages,
      };
    } catch (error) {
      console.error('Error loading detailed session history:', error);
      throw error;
    }
  }

  /**
   * Get a specific prompt (for backward compatibility)
   */
  async getPrompt(promptId: string, _sessionId: string) {
    // Since prompts are now in Claude directory, we need to find them differently
    // For now, return a placeholder that matches the expected interface
    return {
      id: promptId,
      sessionId: _sessionId,
      status: 'completed' as const,
      jobId: promptId,
      metadata: {},
      createdAt: new Date(),
    };
  }

  /**
   * Cancel a prompt (for backward compatibility)
   */
  async cancelPrompt(_promptId: string, _sessionId: string) {
    // Since prompts are processed via queue, we'd need to cancel the job
    // For now, return success
    return { success: true, message: 'Prompt cancellation requested' };
  }

  /**
   * Get history with nested intermediate messages and session working state
   */
  async getHistory(sessionId: string, options: any = {}) {
    // First get the session to include working state
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    const result = await this.getPromptHistory(sessionId, options);

    // Transform to match enhanced HistoryResponseSchema format
    return {
      prompts: result.data,
      session: {
        id: session.id,
        isWorking: session.isWorking || false,
        currentJobId: session.currentJobId,
        lastJobStatus: session.lastJobStatus,
        status: session.status,
      },
      total: result.pagination.total,
      limit: result.pagination.limit,
      offset: result.pagination.offset,
    };
  }

  /**
   * Get intermediate messages for a specific conversation thread
   */
  async getIntermediateMessages(sessionId: string, threadId: string) {
    // Verify session exists
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    if (!session.projectPath) {
      throw new Error('Session does not have project path configured');
    }

    if (!session.claudeDirectoryPath) {
      throw new Error('Session does not have Claude directory path configured');
    }

    try {
      const claudeService = ClaudeDirectoryService.forSessionDirectory(session.claudeDirectoryPath);
      const intermediateMessages = claudeService.getIntermediateMessages(
        session.projectPath,
        threadId,
      );

      // Convert intermediate messages to the expected format
      const formattedMessages = intermediateMessages.map((msg: any, index: number) => {
        const content = this.extractContentFromMessage(msg);

        return {
          id: msg.uuid || `${threadId}-intermediate-${index}`,
          prompt: content,
          response: undefined,
          status: 'completed',
          metadata: {
            type: msg.type,
            role: msg.message?.role,
            uuid: msg.uuid,
            parentUuid: msg.parentUuid,
            isIntermediate: true,
          },
          createdAt: msg.timestamp,
          completedAt: undefined,
        };
      });

      logger.debug(
        {
          sessionId,
          threadId,
          intermediateCount: formattedMessages.length,
        },
        'Retrieved intermediate messages',
      );

      return formattedMessages;
    } catch (error) {
      logger.error(
        {
          sessionId,
          threadId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Error loading intermediate messages',
      );
      return [];
    }
  }

  /**
   * Update prompt result (for backward compatibility)
   */
  async updatePromptResult(_promptId: string, _result: any) {
    // Since prompts are now stored in Claude directory, this is handled there
    // For backward compatibility, return success
    return { success: true };
  }

  /**
   * Export session history to markdown format
   */
  async exportSession(sessionId: string, format: 'json' | 'markdown' = 'markdown') {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      throw new NotFoundError('Session');
    }

    try {
      if (!session.projectPath) {
        throw new Error('Session does not have project path configured');
      }
      if (!session.claudeDirectoryPath) {
        throw new Error('Session does not have Claude directory path configured');
      }
      const claudeService = ClaudeDirectoryService.forSessionDirectory(session.claudeDirectoryPath);
      const exportResult = claudeService.exportSessionHistory(
        session.projectPath,
        format as 'markdown',
      );

      return { content: exportResult.content, format: exportResult.format };
    } catch (error) {
      console.error('Error exporting session from Claude directory:', error);

      // Fallback to basic session info if Claude directory export fails
      const basicExport = {
        sessionId: session.id,
        projectPath: session.projectPath,
        createdAt: session.createdAt,
        lastAccessedAt: session.lastAccessedAt,
        note: 'Detailed conversation history not available - exported from database only',
      };

      return {
        content:
          format === 'json'
            ? JSON.stringify(basicExport, null, 2)
            : `# Session ${session.id}\n\n**Project:** ${session.projectPath}\n**Created:** ${session.createdAt}\n**Last Accessed:** ${session.lastAccessedAt}\n\n*Detailed conversation history not available*`,
        format,
      };
    }
  }
}

export const promptService = new PromptService();
