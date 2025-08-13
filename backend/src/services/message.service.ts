import type { SDKMessage } from '@anthropic-ai/claude-code';
import { and, asc, desc, eq, isNotNull } from 'drizzle-orm';
import { db } from '../db';
import { sessions } from '../db/schema-sqlite';
import { type SessionMessage, sessionMessages } from '../db/schema-sqlite/session_messages';
import type { ApiMessage } from '../schemas/message.schema';
import type { JsonlMessage } from '../types/claude-messages';
import { validateJsonbContentData } from '../utils/message-parser';
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
        const sdkMessage = JSON.parse(dbMsg.contentData);
        
        // Validate the message and extract content
        const validated = validateJsonbContentData(sdkMessage);
        if (validated.length === 0) {
          continue;
        }

        const message = validated[0]!;
        
        // Extract content based on message type
        let content = '';
        let toolCalls: Array<{ name: string; input: any }> | undefined;
        let toolResults: Array<{ tool_use_id: string; content: string }> | undefined;
        let thinking: string | undefined;

        if (message.type === 'user') {
          // Handle user messages
          const userContent = message.message.content;
          if (typeof userContent === 'string') {
            content = userContent;
          } else if (Array.isArray(userContent)) {
            // Extract text content
            const textContent = userContent
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('\n');
            content = textContent;

            // Extract tool results
            const results = userContent
              .filter((c: any) => c.type === 'tool_result')
              .map((c: any) => ({
                tool_use_id: c.tool_use_id,
                content: c.content,
              }));
            if (results.length > 0) {
              toolResults = results;
            }
          }
        } else if (message.type === 'assistant') {
          // Handle assistant messages
          const assistantContent = message.message.content;
          
          // Extract text content
          const textContent = assistantContent
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('\n');
          content = textContent;

          // Extract tool calls
          const calls = assistantContent
            .filter((c: any) => c.type === 'tool_use')
            .map((c: any) => ({
              name: c.name,
              input: c.input,
            }));
          if (calls.length > 0) {
            toolCalls = calls;
          }

          // Extract thinking content
          const thinkingContent = assistantContent
            .filter((c: any) => c.type === 'thinking')
            .map((c: any) => c.thinking)
            .join('\n');
          if (thinkingContent) {
            thinking = thinkingContent;
          }
        }

        const apiMessage: ApiMessage = {
          id: dbMsg.id,
          sessionId: dbMsg.sessionId,
          role: dbMsg.type === 'user' ? 'user' : 'assistant',
          content: content || '[No content]',
          timestamp: dbMsg.createdAt.toISOString(),
          ...(toolCalls && { toolCalls }),
          ...(toolResults && { toolResults }),
          ...(thinking && { thinking }),
        };

        results.push(apiMessage);
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
