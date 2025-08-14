import type { SDKMessage } from '@anthropic-ai/claude-code';
import { and, asc, desc, eq, isNotNull } from 'drizzle-orm';
import { db } from '../db';
import { sessions } from '../db/schema-sqlite';
import { type SessionMessage, sessionMessages } from '../db/schema-sqlite/session_messages';
import type { ApiMessage } from '../schemas/message.schema';
import { isValidSDKMessage, sdkToApiMessage } from '../utils/message-parser';
import { sqliteQueueService } from './queue-sqlite.service';

export class MessageService {
  /**
   * Queue a prompt for processing (no message creation, SDK handles that)
   */
  async queuePrompt(sessionId: string, content: string, options?: { agent?: string }): Promise<void> {
    // Generate a job ID for the prompt
    const promptId = globalThis.crypto.randomUUID();

    // Queue job for Claude processing
    await sqliteQueueService.addPromptJob(
      sessionId,
      promptId,
      content,
      undefined, // allowedTools
      promptId, // messageId
      options?.agent, // agent
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
        if (isValidSDKMessage(rawData)) {
          const apiMessage = sdkToApiMessage(rawData, dbMsg.id, dbMsg.sessionId, dbMsg.createdAt);
          if (apiMessage) {
            results.push(apiMessage);
          }
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
   * Save SDK message directly to database
   */
  async saveSDKMessage(
    sessionId: string,
    sdkMessage: SDKMessage,
    claudeCodeSessionId?: string,
  ): Promise<void> {
    // Determine message type - default to assistant for most message types
    let messageType: 'user' | 'assistant' = 'assistant';

    if (sdkMessage.type === 'user') {
      messageType = 'user';
    }

    // Save message with SDK data as JSON string, including Claude session ID
    await db.insert(sessionMessages).values({
      sessionId,
      type: messageType,
      contentData: JSON.stringify(sdkMessage), // Store raw SDK message
      claudeCodeSessionId: claudeCodeSessionId || null, // Store Claude SDK session ID for resumption
    });
  }

  /**
   * Save user prompt as SDK-formatted message
   */
  async saveUserMessage(sessionId: string, content: string): Promise<void> {
    // Create user message in Claude SDK format
    const userMessage: SDKMessage = {
      type: 'user',
      content,
      id: globalThis.crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    // Save as user message
    await db.insert(sessionMessages).values({
      sessionId,
      type: 'user',
      contentData: JSON.stringify(userMessage),
    });
  }

  /**
   * Get the last Claude Code session ID for resumption
   */
  async getLastClaudeCodeSessionId(sessionId: string): Promise<string | null> {
    const result = await db
      .select({ claudeCodeSessionId: sessionMessages.claudeCodeSessionId })
      .from(sessionMessages)
      .where(and(eq(sessionMessages.sessionId, sessionId), isNotNull(sessionMessages.claudeCodeSessionId)))
      .orderBy(desc(sessionMessages.createdAt))
      .limit(1);

    return result[0]?.claudeCodeSessionId ?? null;
  }

  // Keep these for backwards compatibility temporarily
  async getMessageById(id: string): Promise<SessionMessage | undefined> {
    const result = await db
      .select()
      .from(sessionMessages)
      .where(eq(sessionMessages.id, id))
      .limit(1);
    return result[0];
  }

  async getMessagesBySessionId(sessionId: string): Promise<SessionMessage[]> {
    return db
      .select()
      .from(sessionMessages)
      .where(eq(sessionMessages.sessionId, sessionId))
      .orderBy(desc(sessionMessages.createdAt));
  }

  async deleteMessage(id: string): Promise<void> {
    await db.delete(sessionMessages).where(eq(sessionMessages.id, id));
  }

  async deleteMessagesBySessionId(sessionId: string): Promise<void> {
    await db.delete(sessionMessages).where(eq(sessionMessages.sessionId, sessionId));
  }
}

export const messageService = new MessageService();
