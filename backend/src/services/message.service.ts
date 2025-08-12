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
            // Load JSONL content for this claude session ID
            const claudeService = ClaudeDirectoryService.forSessionDirectory(
              session.claudeDirectoryPath,
            );
            const projectDir = ClaudeDirectoryService.getClaudeDirectoryPath(session.projectPath);
            const jsonlFilePath = `${projectDir}/${message.claudeSessionId}.jsonl`;
            
            // Read the specific JSONL file for this Claude Code session
            const jsonlMessages = claudeService.readConversationFile(jsonlFilePath);
            
            // Convert JSONL messages to intermediate message format
            const formattedMessages = jsonlMessages.map((msg: any, index: number) => ({
              id: msg.uuid || `${message.claudeSessionId}-msg-${index}`,
              content: this.extractContentFromMessage(msg),
              role: msg.type,
              type: msg.type,
              timestamp: msg.timestamp || new Date().toISOString(),
              metadata: {
                parentUuid: msg.parentUuid,
                sessionId: msg.sessionId,
                isSidechain: msg.isSidechain,
                userType: msg.userType,
              },
            }));
            
            return {
              ...message,
              childMessages: formattedMessages,
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
