import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { sessions } from '@/db/schema';
import { NotFoundError } from '@/types';
import { logger } from '@/utils/logger';
import ClaudeDirectoryService from './claude-directory.service';
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
              if (item.type === 'text') return item.text;
              if (item.type === 'tool_use') return `[Tool: ${item.name}]`;
              return '';
            })
            .filter(Boolean)
            .join(' ');
        }
      }
      // Handle tool use results
      if (msg.toolUseResult) {
        content += content ? `\n\n[Tool Result]\n${msg.toolUseResult}` : `[Tool Result]\n${msg.toolUseResult}`;
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

    // Generate a unique job ID for this prompt
    const jobId = crypto.randomUUID();

    // Add to queue for processing - no database record needed
    // The Claude Code SDK will handle storage in Claude directory
    await queueService.addPromptJob(
      sessionId,
      jobId, // Use jobId instead of prompt record ID
      data.prompt,
      data.allowedTools || session.metadata?.allowedTools,
    );

    // Update last accessed time for session
    await db.update(sessions).set({ lastAccessedAt: new Date() }).where(eq(sessions.id, sessionId));

    // Return job info (no database prompt record)
    return {
      id: jobId,
      sessionId,
      prompt: data.prompt,
      status: 'queued' as const,
      jobId,
      metadata: {
        allowedTools: data.allowedTools || session.metadata?.allowedTools,
      },
      createdAt: new Date().toISOString(),
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

    logger.debug(
      {
        sessionId,
        projectPath: session.projectPath,
        claudeDirectoryPath: session.claudeDirectoryPath,
        hasProjectPath: !!session.projectPath,
      },
      'Found session for prompt history',
    );

    const { limit = 50, offset = 0 } = options;

    try {
      // Load conversation history from Claude directory
      const claudeService = new ClaudeDirectoryService();
      if (!session.projectPath) {
        const error = 'Session does not have project path configured';
        logger.error(
          {
            sessionId,
            session: {
              id: session.id,
              projectPath: session.projectPath,
              claudeDirectoryPath: session.claudeDirectoryPath,
            },
          },
          'Missing project path for session',
        );
        throw new Error(error);
      }

      logger.debug(
        {
          sessionId,
          projectPath: session.projectPath,
          claudeDirectoryPath: session.claudeDirectoryPath,
        },
        'Loading conversation threads from Claude directory',
      );

      const { conversationThreads } = claudeService.getConversationThreads(session.projectPath);

      logger.debug(
        {
          sessionId,
          threadCount: conversationThreads.length,
          threadsWithFinalResponse: conversationThreads.filter(t => t.finalResponse).length,
        },
        'Processing conversation threads for prompt history',
      );

      // Convert conversation threads to prompt history format (user prompts + final responses)
      const allMessages: any[] = [];

      for (const thread of conversationThreads) {
        // Add user prompt
        const userPrompt = this.extractContentFromMessage(thread.userPrompt);
        allMessages.push({
          id: thread.userPrompt.uuid,
          prompt: userPrompt,
          response: undefined,
          status: 'completed',
          metadata: {
            type: thread.userPrompt.type,
            role: thread.userPrompt.message?.role || 'user',
            uuid: thread.userPrompt.uuid,
            parentUuid: thread.userPrompt.parentUuid,
            threadId: thread.threadId,
            hasIntermediateMessages: thread.intermediateMessages.length > 0,
          },
          createdAt: thread.userPrompt.timestamp,
          completedAt: undefined,
        });

        // Add final response if it exists
        if (thread.finalResponse) {
          const finalResponseContent = this.extractContentFromMessage(thread.finalResponse);
          allMessages.push({
            id: thread.finalResponse.uuid,
            prompt: finalResponseContent,
            response: undefined,
            status: 'completed',
            metadata: {
              type: thread.finalResponse.type,
              role: thread.finalResponse.message?.role || 'assistant',
              uuid: thread.finalResponse.uuid,
              parentUuid: thread.finalResponse.parentUuid,
              threadId: thread.threadId,
              isThreadFinalResponse: true,
              hasIntermediateMessages: thread.intermediateMessages.length > 0,
            },
            createdAt: thread.finalResponse.timestamp,
            completedAt: undefined,
          });
        }
      }

      logger.debug(
        {
          sessionId,
          totalMessages: allMessages.length,
          messagePreview: allMessages.slice(0, 3).map((m) => ({
            id: m.id,
            hasPrompt: !!m.prompt,
            hasResponse: !!m.response,
            createdAt: m.createdAt,
          })),
        },
        'Converted messages for prompt history',
      );

      // Sort by timestamp descending (most recent first)
      allMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Apply pagination
      const paginatedMessages = allMessages.slice(offset, offset + limit);

      logger.debug(
        {
          sessionId,
          totalMessages: allMessages.length,
          returnedMessages: paginatedMessages.length,
          limit,
          offset,
        },
        'Returning prompt history',
      );

      return {
        data: paginatedMessages,
        pagination: {
          total: allMessages.length,
          limit,
          offset,
          hasMore: offset + limit < allMessages.length,
        },
      };
    } catch (error) {
      logger.error(
        {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Error loading conversation history from Claude directory',
      );

      // Fallback: return empty history if Claude directory not available
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
      // Load conversation history from Claude directory
      const claudeService = new ClaudeDirectoryService();
      if (!session.projectPath) {
        throw new Error('Session does not have project path configured');
      }
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
   * Get history (alias for getPromptHistory)
   */
  async getHistory(sessionId: string, options: any = {}) {
    const result = await this.getPromptHistory(sessionId, options);

    // Transform to match HistoryResponseSchema format
    return {
      prompts: result.data,
      total: result.pagination.total,
      limit: result.pagination.limit,
      offset: result.pagination.offset,
    };
  }

  /**
   * Get intermediate messages for a specific conversation thread
   */
  async getIntermediateMessages(
    sessionId: string,
    threadId: string
  ) {
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

    try {
      const claudeService = new ClaudeDirectoryService();
      const intermediateMessages = claudeService.getIntermediateMessages(session.projectPath, threadId);

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
      const claudeService = new ClaudeDirectoryService();
      if (!session.projectPath) {
        throw new Error('Session does not have project path configured');
      }
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
