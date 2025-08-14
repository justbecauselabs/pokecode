import type { SDKMessage, SDKUserMessage } from '@anthropic-ai/claude-code';
import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db';
import { sessions } from '../db/schema-sqlite';
import { type SessionMessage, sessionMessages } from '../db/schema-sqlite/session_messages';
import type { ApiMessage } from '../schemas/message.schema';
import { extractTokenCount, sdkToApiMessage } from '../utils/message-parser';
import { sqliteQueueService } from './queue-sqlite.service';

export class MessageService {
  /**
   * Queue a prompt for processing (no message creation, SDK handles that)
   */
  async queuePrompt(sessionId: string, content: string): Promise<void> {
    // Generate a job ID for the prompt
    const promptId = globalThis.crypto.randomUUID();

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
   * Get all messages as a flat list with tool data embedded
   */
  async getMessages(sessionId: string): Promise<ApiMessage[]> {
    // Get DB messages in chronological order
    const dbMessages = await db
      .select()
      .from(sessionMessages)
      .where(eq(sessionMessages.sessionId, sessionId))
      .orderBy(asc(sessionMessages.createdAt));

    const results: ApiMessage[] = [];

    for (const dbMsg of dbMessages) {
      if (!dbMsg.contentData) {
        continue;
      }

      try {
        const rawData = JSON.parse(dbMsg.contentData);

        // Check if it's a valid SDK message
        const apiMessage = sdkToApiMessage(rawData, dbMsg.id, dbMsg.sessionId, dbMsg.createdAt);
        if (apiMessage) {
          results.push(apiMessage);
        }
      } catch (error) {
        // Skip malformed messages
        console.warn(`Failed to parse message ${dbMsg.id}:`, error);
      }
    }

    return results;
  }

  /**
   * Update message with content data (stored as JSON string)
   */
  async updateMessageContentData(messageId: string, contentData: SDKMessage): Promise<void> {
    await db
      .update(sessionMessages)
      .set({
        contentData: JSON.stringify(contentData),
      })
      .where(eq(sessionMessages.id, messageId));
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
      await tx.insert(sessionMessages).values({
        sessionId,
        type: messageType,
        contentData: JSON.stringify(sdkMessage), // Store raw SDK message
        claudeCodeSessionId: claudeCodeSessionId || null, // Store Claude SDK session ID for resumption
        tokenCount: tokenCount > 0 ? tokenCount : null, // Store token count if available
      });

      // Update session counters
      await tx
        .update(sessions)
        .set({
          messageCount: sql`${sessions.messageCount} + 1`,
          tokenCount: sql`${sessions.tokenCount} + ${tokenCount}`,
        })
        .where(eq(sessions.id, sessionId));
    });
  }

  /**
   * Save user prompt as SDK-formatted message and update session counters
   */
  async saveUserMessage(sessionId: string, content: string): Promise<void> {
    // Create user message in Claude SDK format
    const userMessage: SDKUserMessage = {
      type: 'user',
      message: {
        role: 'user',
        content: content,
      },
      parent_tool_use_id: null,
      session_id: globalThis.crypto.randomUUID(),
    };

    // Use a transaction to ensure consistency
    await db.transaction(async (tx) => {
      // Save as user message
      await tx.insert(sessionMessages).values({
        sessionId,
        type: 'user',
        contentData: JSON.stringify(userMessage),
        tokenCount: null, // User messages don't have token costs
      });

      // Update session message count
      await tx
        .update(sessions)
        .set({
          messageCount: sql`${sessions.messageCount} + 1`,
        })
        .where(eq(sessions.id, sessionId));
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
}

export const messageService = new MessageService();
