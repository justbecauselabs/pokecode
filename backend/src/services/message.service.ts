import { join } from 'node:path';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { sessions } from '../db/schema';
import { type SessionMessage, sessionMessages } from '../db/schema/session_messages';
import type { ApiMessage } from '../schemas/message.schema';
import { jsonlToApiChildren, parseJsonlFile } from '../utils/message-parser';
import ClaudeDirectoryService from './claude-directory.service';
import { queueService } from './queue.service';

export class MessageService {
  /**
   * 1. Create a user message and queue for processing
   */
  async createMessage(sessionId: string, content: string): Promise<ApiMessage> {
    const insertValues = {
      sessionId: sessionId,
      text: content,
      type: 'user' as const,
    };

    // Save to DB using Drizzle properly
    const result = await db.insert(sessionMessages).values(insertValues).returning();

    const dbMessage = result[0];
    if (!dbMessage) {
      throw new Error('Failed to create message');
    }

    // Queue job for Claude processing
    let jobId: string | undefined;
    try {
      jobId = await queueService.addPromptJob(
        sessionId,
        dbMessage.id, // Using message ID as prompt ID
        content,
        undefined, // allowedTools
        dbMessage.id, // messageId
      );
    } catch (queueError) {
      throw queueError;
    }

    // Update session to indicate work is in progress
    if (jobId) {
      await db
        .update(sessions)
        .set({
          isWorking: true,
          currentJobId: jobId,
        })
        .where(eq(sessions.id, sessionId));
    }

    // Return immediate response (no children yet)
    return {
      id: dbMessage.id,
      sessionId,
      role: 'user',
      content,
      timestamp: dbMessage.createdAt.toISOString(),
      children: [], // Empty until Claude responds
    };
  }

  /**
   * 2. Get all messages with nested JSONL content
   */
  async getMessages(sessionId: string): Promise<ApiMessage[]> {
    // Get DB messages in chronological order
    const dbMessages = await db
      .select()
      .from(sessionMessages)
      .where(eq(sessionMessages.sessionId, sessionId))
      .orderBy(asc(sessionMessages.createdAt));

    // Get session for project path
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    // Convert each DB message to API format with nested JSONL
    const results: ApiMessage[] = [];

    for (const dbMsg of dbMessages) {
      const apiMessage: ApiMessage = {
        id: dbMsg.id,
        sessionId: dbMsg.sessionId,
        role: dbMsg.type === 'user' ? 'user' : 'assistant',
        content: dbMsg.text,
        timestamp: dbMsg.createdAt.toISOString(),
        ...(dbMsg.claudeSessionId && { claudeSessionId: dbMsg.claudeSessionId }),
        children: [], // Default empty
      };

      // If has JSONL, parse and nest as children
      if (dbMsg.claudeSessionId && session?.projectPath) {
        const projectDir = ClaudeDirectoryService.getClaudeDirectoryPath(session.projectPath);
        const jsonlPath = join(projectDir, `${dbMsg.claudeSessionId}.jsonl`);
        const jsonlMessages = parseJsonlFile(jsonlPath);
        apiMessage.children = jsonlToApiChildren(jsonlMessages);
      }

      results.push(apiMessage);
    }

    return results;
  }

  /**
   * 3. Save assistant message after Claude responds
   */
  async saveAssistantMessage(
    sessionId: string,
    content: string,
  ): Promise<void> {
    await db.insert(sessionMessages).values({
      sessionId,
      text: content,
      type: 'assistant',
    });
  }

  /**
   * Update user message with Claude session ID (for linking to JSONL)
   */
  async updateClaudeSessionId(messageId: string, claudeSessionId: string): Promise<void> {
    await db
      .update(sessionMessages)
      .set({ claudeSessionId })
      .where(eq(sessionMessages.id, messageId));
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
