import type { SDKMessage } from '@anthropic-ai/claude-code';
import { createId } from '@paralleldrive/cuid2';
import type { Message } from '@pokecode/api';
import { and, asc, desc, eq, gt, isNotNull, or, sql } from 'drizzle-orm';

import { db } from '../db';
import { sessions } from '../db/schema-sqlite';
import { sessionMessages } from '../db/schema-sqlite/session_messages';
import { createChildLogger } from '../utils/logger';
import { extractTokenCount, parseDbMessage } from '../utils/message-parser';
import { emitNewMessage, emitSessionDone } from './event-bus.service';
import { sqliteQueueService } from './queue-sqlite.service';

// Temporary type definition until packages/api is rebuilt
type Pagination = {
  hasNextPage: boolean;
  nextCursor: string | null;
  totalFetched: number;
};

const logger = createChildLogger('message-service');

export class MessageService {
  /**
   * Queue a prompt for processing (no message creation, SDK handles that)
   */
  async queuePrompt(sessionId: string, content: string): Promise<void> {
    // Generate a job ID for the prompt
    const promptId = createId();

    // Queue job for Claude processing
    await sqliteQueueService.addPromptJob(
      sessionId,
      promptId,
      content,
      undefined, // allowedTools
      promptId, // messageId
    );

    // Update session to indicate work is in progress
    await db
      .update(sessions)
      .set({
        isWorking: true,
        currentJobId: promptId,
      })
      .where(eq(sessions.id, sessionId));
  }

  /**
   * Get messages using cursor pagination
   */
  async getMessages(options: {
    sessionId: string;
    projectPath?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ messages: Message[]; pagination: Pagination }> {
    const { sessionId, projectPath, cursor, limit } = options;

    // Build query with cursor pagination
    const pageLimit = limit || 50;

    let dbMessages: Array<{
      id: string;
      sessionId: string;
      type: 'user' | 'assistant' | 'system' | 'result' | 'error';
      contentData: string | null;
      claudeCodeSessionId: string | null;
      tokenCount: number | null;
      createdAt: Date;
    }>;
    if (cursor) {
      // First, get the createdAt timestamp for the cursor message ID
      const cursorMessage = await db
        .select({ createdAt: sessionMessages.createdAt })
        .from(sessionMessages)
        .where(eq(sessionMessages.id, cursor))
        .limit(1);

      if (cursorMessage.length === 0) {
        // Invalid cursor, return empty result
        dbMessages = [];
      } else {
        const firstMessage = cursorMessage[0];
        if (!firstMessage) {
          // Invalid cursor, return empty result
          dbMessages = [];
        } else {
          const cursorTimestamp = firstMessage.createdAt;
          dbMessages = await db
            .select()
            .from(sessionMessages)
            .where(
              and(
                eq(sessionMessages.sessionId, sessionId),
                // Use timestamp comparison first, then fall back to ID comparison for same timestamps
                or(
                  gt(sessionMessages.createdAt, cursorTimestamp),
                  and(eq(sessionMessages.createdAt, cursorTimestamp), gt(sessionMessages.id, cursor)),
                ),
              ),
            )
            .orderBy(asc(sessionMessages.createdAt), asc(sessionMessages.id))
            .limit(pageLimit + 1);
        }
      }
    } else {
      dbMessages = await db
        .select()
        .from(sessionMessages)
        .where(eq(sessionMessages.sessionId, sessionId))
        .orderBy(asc(sessionMessages.createdAt), asc(sessionMessages.id))
        .limit(pageLimit + 1);
    }

    // Check if there are more pages
    const hasNextPage = dbMessages.length > pageLimit;
    if (hasNextPage) {
      dbMessages.pop(); // Remove the extra item
    }

    // Transform messages
    const messages: Message[] = [];
    for (const dbMsg of dbMessages) {
      const parsedMessage = parseDbMessage(dbMsg, projectPath);
      if (parsedMessage) {
        messages.push(parsedMessage);
      }
    }

    // Calculate pagination info
    const nextCursor =
      hasNextPage && dbMessages.length > 0 ? dbMessages[dbMessages.length - 1]?.id || null : null;

    const pagination: Pagination = {
      hasNextPage,
      nextCursor,
      totalFetched: messages.length,
    };

    return {
      messages,
      pagination,
    };
  }

  /**
   * Save SDK message directly to database and update session counters
   */
  async saveSDKMessage(
    sessionId: string,
    sdkMessage: SDKMessage,
    claudeCodeSessionId?: string,
  ): Promise<void> {
    // Determine message type for database - map all to user/assistant for compatibility
    let messageType: 'user' | 'assistant' = 'assistant';

    if (sdkMessage.type === 'user') {
      messageType = 'user';
    }
    // system and result messages stored as assistant type with type preserved in JSON

    // Extract token count from the SDK message
    const tokenCount = extractTokenCount(sdkMessage);

    // Use a transaction to ensure consistency
    await db.transaction(async (tx) => {
      // Save message with SDK data as JSON string, including Claude session ID and token count
      const [insertedMessage] = await tx
        .insert(sessionMessages)
        .values({
          id: createId(),
          sessionId,
          type: messageType,
          contentData: JSON.stringify(sdkMessage), // Store raw SDK message
          claudeCodeSessionId: claudeCodeSessionId || null, // Store Claude SDK session ID for resumption
          tokenCount: tokenCount > 0 ? tokenCount : null, // Store token count if available
        })
        .returning(); // Use returning() to get the inserted row

      // Update session counters
      await tx
        .update(sessions)
        .set({
          messageCount: sql`${sessions.messageCount} + 1`,
          tokenCount: sql`${sessions.tokenCount} + ${tokenCount}`,
        })
        .where(eq(sessions.id, sessionId));

      // Get project path for message parsing
      const session = await tx.query.sessions.findFirst({
        where: eq(sessions.id, sessionId),
        columns: { projectPath: true },
      });

      // After DB commit, emit real-time event with full Message object
      if (insertedMessage && session) {
        const parsedMessage = parseDbMessage(insertedMessage, session.projectPath);
        if (parsedMessage) {
          emitNewMessage(sessionId, parsedMessage);
        }
      }
    });
  }

  /**
   * Save user prompt as SDK-formatted message and update session counters
   */
  async saveUserMessage(sessionId: string, content: string): Promise<void> {
    // Create user message in Claude SDK format
    const userMessage: SDKMessage & { type: 'user' } = {
      type: 'user',
      message: {
        role: 'user',
        content: content,
      },
      parent_tool_use_id: null,
      session_id: createId(),
    };

    // Use a transaction to ensure consistency
    await db.transaction(async (tx) => {
      // Save as user message
      const [insertedMessage] = await tx
        .insert(sessionMessages)
        .values({
          id: createId(),
          sessionId,
          type: 'user',
          contentData: JSON.stringify(userMessage),
          tokenCount: null, // User messages don't have token costs
        })
        .returning();

      // Update session message count
      await tx
        .update(sessions)
        .set({
          messageCount: sql`${sessions.messageCount} + 1`,
        })
        .where(eq(sessions.id, sessionId));

      // Get project path for message parsing
      const session = await tx.query.sessions.findFirst({
        where: eq(sessions.id, sessionId),
        columns: { projectPath: true },
      });

      // After DB commit, emit real-time event with full Message object
      if (insertedMessage && session) {
        const parsedMessage = parseDbMessage(insertedMessage, session.projectPath);
        if (parsedMessage) {
          emitNewMessage(sessionId, parsedMessage);
        }
      }
    });
  }

  /**
   * Get the last Claude Code session ID for resumption
   */
  async getLastClaudeCodeSessionId(sessionId: string): Promise<string | null> {
    const result = await db
      .select({ claudeCodeSessionId: sessionMessages.claudeCodeSessionId })
      .from(sessionMessages)
      .where(
        and(
          eq(sessionMessages.sessionId, sessionId),
          isNotNull(sessionMessages.claudeCodeSessionId),
        ),
      )
      .orderBy(desc(sessionMessages.createdAt))
      .limit(1);

    return result[0]?.claudeCodeSessionId ?? null;
  }

  /**
   * Get raw messages directly from database with parsed content_data
   */
  async getRawMessages(sessionId: string): Promise<
    Array<{
      id: string;
      sessionId: string;
      type: string;
      contentData: SDKMessage; // Parsed JSON object
      claudeCodeSessionId: string | null;
      tokenCount: number | null;
      createdAt: Date;
    }>
  > {
    // Get DB messages in chronological order
    const dbMessages = await db
      .select()
      .from(sessionMessages)
      .where(eq(sessionMessages.sessionId, sessionId))
      .orderBy(asc(sessionMessages.createdAt));

    // Parse content_data from JSON string to object
    return dbMessages.map((msg) => ({
      id: msg.id,
      sessionId: msg.sessionId,
      type: msg.type,
      contentData: msg.contentData ? JSON.parse(msg.contentData) : null,
      claudeCodeSessionId: msg.claudeCodeSessionId,
      tokenCount: msg.tokenCount,
      createdAt: msg.createdAt,
    }));
  }

  /**
   * Cancel current session processing
   */
  async cancelSession(sessionId: string): Promise<void> {
    // Get the current session to check if it's working
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
      columns: {
        currentJobId: true,
        isWorking: true,
      },
    });

    if (!session || !session.isWorking) {
      logger.debug(
        { sessionId, hasSession: !!session, isWorking: session?.isWorking },
        'No active session to cancel',
      );
      return;
    }

    logger.info({ sessionId, currentJobId: session.currentJobId }, 'Cancelling active session');

    // Cancel all jobs for this session (simplified approach since we can only have one active job per session)
    await sqliteQueueService.cancelJobsForSession(sessionId);

    // Update session state immediately
    await db
      .update(sessions)
      .set({
        isWorking: false,
        currentJobId: null,
        lastJobStatus: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    // Emit session done (cancelled)
    emitSessionDone(sessionId);

    logger.info({ sessionId }, 'Successfully cancelled session');
  }
}

export const messageService = new MessageService();
