import { desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { sessions } from '../db/schema';
import {
  type NewSessionMessage,
  type SessionMessage,
  sessionMessages,
} from '../db/schema/session_messages';
import ClaudeDirectoryService from './claude-directory.service';

export class MessageService {
  async createMessage(data: NewSessionMessage): Promise<SessionMessage> {
    const [message] = await db.insert(sessionMessages).values(data).returning();
    return message;
  }

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

  async updateClaudeSessionId(messageId: string, claudeSessionId: string): Promise<void> {
    await db
      .update(sessionMessages)
      .set({ claudeSessionId })
      .where(eq(sessionMessages.id, messageId));
  }

  async getMessagesWithContent(sessionId: string) {
    // Get message metadata from database
    const messages = await this.getMessagesBySessionId(sessionId);

    // Get session to access project path
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session || !session.projectPath) {
      // Return messages without enrichment if session not found or no project path
      return messages.map((message) => ({
        ...message,
        childMessages: [],
      }));
    }

    // Enrich with JSONL content for messages that have claude_session_id
    const enrichedMessages = await Promise.all(
      messages.map(async (message) => {
        if (message.claudeSessionId && session.claudeDirectoryPath) {
          try {
            // Load JSONL content for this claude session using thread ID
            const claudeService = ClaudeDirectoryService.forSessionDirectory(
              session.claudeDirectoryPath,
            );
            const jsonlMessages = claudeService.getIntermediateMessages(
              session.projectPath,
              message.claudeSessionId,
            );
            return {
              ...message,
              childMessages: jsonlMessages,
            };
          } catch (_error) {
            // Fallback to just the database message if JSONL read fails
            return {
              ...message,
              childMessages: [],
            };
          }
        }
        return {
          ...message,
          childMessages: [],
        };
      }),
    );

    return enrichedMessages;
  }

  async deleteMessage(id: string): Promise<void> {
    await db.delete(sessionMessages).where(eq(sessionMessages.id, id));
  }

  async deleteMessagesBySessionId(sessionId: string): Promise<void> {
    await db.delete(sessionMessages).where(eq(sessionMessages.sessionId, sessionId));
  }
}

export const messageService = new MessageService();
