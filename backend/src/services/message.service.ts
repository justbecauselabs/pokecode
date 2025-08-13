import type { SDKMessage } from '@anthropic-ai/claude-code';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { sessions } from '../db/schema';
import { type SessionMessage, sessionMessages } from '../db/schema/session_messages';
import type { ApiMessage } from '../schemas/message.schema';
import type { JsonlMessage } from '../types/claude-messages';
import { queueService } from './queue.service';

export class MessageService {
  /**
   * Queue a prompt for processing (no message creation, SDK handles that)
   */
  async queuePrompt(sessionId: string, content: string): Promise<void> {
    // Generate a job ID for the prompt
    const promptId = globalThis.crypto.randomUUID();

    // Queue job for Claude processing
    await queueService.addPromptJob(
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
   * 2. Get all messages with content from JSONB storage
   */
  async getMessages(sessionId: string): Promise<ApiMessage[]> {
    // Get DB messages in chronological order
    const dbMessages = await db
      .select()
      .from(sessionMessages)
      .where(eq(sessionMessages.sessionId, sessionId))
      .orderBy(asc(sessionMessages.createdAt));

    // Convert each DB message to API format with nested JSONB content
    const results: ApiMessage[] = [];

    for (const dbMsg of dbMessages) {
      // Extract content from SDK message data
      let content = `${dbMsg.type} message`;

      if (dbMsg.contentData) {
        try {
          const sdkMessage = JSON.parse(dbMsg.contentData);

          // Extract text content from assistant messages
          if (sdkMessage.type === 'assistant' && sdkMessage.message?.content) {
            const textContent = sdkMessage.message.content
              .filter(
                (c: unknown) => c && typeof c === 'object' && 'type' in c && c.type === 'text',
              )
              .map((c: unknown) => (c as { text: string }).text)
              .join('\n');
            if (textContent) {
              content = textContent;
            }
          } else if (sdkMessage.type === 'user' && typeof sdkMessage.content === 'string') {
            content = sdkMessage.content;
          }
        } catch (error) {
          // If parsing fails, keep default content
        }
      }

      const apiMessage: ApiMessage = {
        id: dbMsg.id,
        sessionId: dbMsg.sessionId,
        role: dbMsg.type === 'user' ? 'user' : 'assistant',
        content,
        timestamp: dbMsg.createdAt.toISOString(),
        ...(dbMsg.claudeSessionId && { claudeSessionId: dbMsg.claudeSessionId }),
        children: [], // Simplified - no more complex children processing
      };

      results.push(apiMessage);
    }

    return results;
  }

  /**
   * Update message with content data (stored as JSON string)
   */
  async updateMessageContentData(messageId: string, contentData: JsonlMessage[]): Promise<void> {
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
  async saveSDKMessage(sessionId: string, sdkMessage: SDKMessage): Promise<void> {
    // Determine message type - default to assistant for most message types
    let messageType: 'user' | 'assistant' = 'assistant';

    if (sdkMessage.type === 'user') {
      messageType = 'user';
    }

    // Save message with SDK data as JSON string
    await db.insert(sessionMessages).values({
      sessionId,
      type: messageType,
      contentData: JSON.stringify(sdkMessage), // Store raw SDK message
    });
  }

  /**
   * Save user prompt as SDK-formatted message
   */
  async saveUserMessage(sessionId: string, content: string): Promise<void> {
    // Create user message in Claude SDK format
    const userMessage = {
      type: 'user' as const,
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
