import type { SDKMessage as ClaudeSDKMessage } from '@anthropic-ai/claude-code';
import { createId } from '@paralleldrive/cuid2';
import type { CodexSDKMessage, Message, PokeCodeUserMessage } from '@pokecode/types';
import { and, asc, desc, eq, gt, isNotNull, or, sql } from 'drizzle-orm';

import { db } from '../database';
import { sessions } from '../database/schema-sqlite';
import { sessionMessages } from '../database/schema-sqlite/session_messages';
import { extractTokenCount } from '../utils/claude-code-message-parser';
import { createChildLogger } from '../utils/logger';
import { parseDbMessageByProvider } from '../utils/provider-message-parser';
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
  async queuePrompt(sessionId: string, content: string, model?: string): Promise<void> {
    // Generate a job ID for the prompt
    const promptId = createId();

    // Queue job for Claude processing
    await sqliteQueueService.addPromptJob(
      sessionId,
      promptId,
      content,
      undefined, // allowedTools
      promptId, // messageId
      model, // model
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
      provider: 'claude-code' | 'codex-cli';
      providerSessionId: string | null;
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
                  and(
                    eq(sessionMessages.createdAt, cursorTimestamp),
                    gt(sessionMessages.id, cursor),
                  ),
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
      const parsedMessage = parseDbMessageByProvider(dbMsg, projectPath);
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
  async saveSDKMessage(params: {
    sessionId: string;
    sdkMessage: ClaudeSDKMessage | CodexSDKMessage;
    providerSessionId?: string;
    provider?: 'claude-code' | 'codex-cli';
  }): Promise<void> {
    const { sessionId, sdkMessage, providerSessionId, provider } = params;
    // Determine message type for database - map all to user/assistant for compatibility
    let messageType: 'user' | 'assistant' = 'assistant';
    if ('type' in sdkMessage && sdkMessage.type === 'user') {
      messageType = 'user';
    }
    // system and result messages stored as assistant type with type preserved in JSON

    // Extract token count from the SDK message
    const tokenCount = 'type' in sdkMessage ? extractTokenCount(sdkMessage as ClaudeSDKMessage) : 0;

    // Use a transaction to ensure consistency
    await db.transaction(async (tx) => {
      // Save message with SDK data as JSON string, including Claude session ID and token count
      // Ensure session exists and read provider once
      const sessionRow = await tx.query.sessions.findFirst({
        where: eq(sessions.id, sessionId),
        columns: { provider: true, projectPath: true },
      });
      if (!sessionRow) {
        throw new Error('Session not found');
      }

      const providerToUse = provider ?? sessionRow.provider;

      const [insertedMessage] = await tx
        .insert(sessionMessages)
        .values({
          id: createId(),
          sessionId,
          provider: providerToUse,
          type: messageType,
          contentData: JSON.stringify(sdkMessage), // Store raw SDK message
          providerSessionId: providerSessionId || null, // Store provider session ID for resumption
          tokenCount: tokenCount > 0 ? tokenCount : null, // Store token count if available
        })
        .returning(); // Use returning() to get the inserted row

      // Update session counters
      await tx
        .update(sessions)
        .set({
          messageCount: sql`${sessions.messageCount} + 1`,
          tokenCount: sql`${sessions.tokenCount} + ${tokenCount}`,
          lastMessageSentAt: new Date(),
        })
        .where(eq(sessions.id, sessionId));

      // Get project path for message parsing
      const session = { projectPath: sessionRow.projectPath };

      // After DB commit, emit real-time event with full Message object
      if (insertedMessage && session) {
        const parsedMessage = parseDbMessageByProvider(insertedMessage, session.projectPath);
        if (parsedMessage) {
          emitNewMessage(sessionId, parsedMessage);
        } else {
          logger.warn(
            {
              sessionId,
              messageId: insertedMessage.id,
              messageType: insertedMessage.type,
              hasContentData: !!insertedMessage.contentData,
            },
            'parseDbMessage returned null - SSE event will not be emitted',
          );
        }
      } else {
        logger.warn(
          { sessionId, hasMessage: !!insertedMessage, hasSession: !!session },
          'Missing message or session - SSE event will not be emitted',
        );
      }
    });
  }

  /**
   * Save user prompt as SDK-formatted message and update session counters
   */
  async saveUserMessage(sessionId: string, content: string): Promise<void> {
    // Create provider-agnostic PokéCode user message
    const { createPokeCodeUserMessage } = await import('../utils/pokecode-user-message');
    const userMessage: PokeCodeUserMessage = createPokeCodeUserMessage({ content });

    // Use a transaction to ensure consistency
    await db.transaction(async (tx) => {
      // Save as user message
      // Get provider for this session
      const sessionRow = await tx.query.sessions.findFirst({
        where: eq(sessions.id, sessionId),
        columns: { provider: true, projectPath: true },
      });
      if (!sessionRow) {
        throw new Error('Session not found');
      }

      const [insertedMessage] = await tx
        .insert(sessionMessages)
        .values({
          id: createId(),
          sessionId,
          provider: sessionRow.provider,
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
          lastMessageSentAt: new Date(),
        })
        .where(eq(sessions.id, sessionId));

      // Get project path for message parsing
      const session = sessionRow
        ? { projectPath: sessionRow.projectPath }
        : await tx.query.sessions.findFirst({
            where: eq(sessions.id, sessionId),
            columns: { projectPath: true },
          });

      // After DB commit, emit real-time event with full Message object
      if (insertedMessage && session) {
        const parsedMessage = parseDbMessageByProvider(insertedMessage, session.projectPath);
        if (parsedMessage) {
          emitNewMessage(sessionId, parsedMessage);
        } else {
          logger.warn(
            {
              sessionId,
              messageId: insertedMessage.id,
              messageType: insertedMessage.type,
              hasContentData: !!insertedMessage.contentData,
            },
            'parseDbMessage returned null - SSE event will not be emitted',
          );
        }
      } else {
        logger.warn(
          { sessionId, hasMessage: !!insertedMessage, hasSession: !!session },
          'Missing message or session - SSE event will not be emitted',
        );
      }
    });
  }

  /**
   * Get the last Claude Code session ID for resumption
   */
  async getLastProviderSessionId(sessionId: string): Promise<string | null> {
    const result = await db
      .select({ providerSessionId: sessionMessages.providerSessionId })
      .from(sessionMessages)
      .where(
        and(eq(sessionMessages.sessionId, sessionId), isNotNull(sessionMessages.providerSessionId)),
      )
      .orderBy(desc(sessionMessages.createdAt))
      .limit(1);

    return result[0]?.providerSessionId ?? null;
  }

  /**
   * Get raw messages directly from database with parsed content_data
   */
  async getRawMessages(sessionId: string): Promise<
    Array<{
      id: string;
      sessionId: string;
      type: string;
      contentData: ClaudeSDKMessage | CodexSDKMessage | null; // Parsed JSON object
      providerSessionId: string | null;
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
      providerSessionId: msg.providerSessionId,
      tokenCount: msg.tokenCount,
      createdAt: msg.createdAt,
    }));
  }

  /**
   * Cancel current session processing
   */
  async cancelSession(sessionId: string): Promise<void> {
    // Get the current session to check if it's working
    const session = await db
      .select({
        currentJobId: sessions.currentJobId,
        isWorking: sessions.isWorking,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .get();

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
