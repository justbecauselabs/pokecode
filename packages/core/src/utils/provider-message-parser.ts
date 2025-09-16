import { type Message, PokeCodeUserMessageSchema } from '@pokecode/types';
import { z } from 'zod';
import type { SessionMessage } from '../database/schema-sqlite/session_messages';
import { parseClaudeDbMessage } from './claude-code-message-parser';
import { parseCodexDbMessage } from './codex-message-parser';

export function parseDbMessageByProvider(
  dbMessage: SessionMessage,
  projectPath?: string,
): Message | null {
  // Handle error rows stored by our system
  if (dbMessage.type === 'error') {
    try {
      const data = dbMessage.contentData ? JSON.parse(dbMessage.contentData) : null;
      const ErrorMessageSchema = z.object({ message: z.string() });
      const msg = ErrorMessageSchema.safeParse(data);
      const content = msg.success ? msg.data.message : typeof data === 'string' ? data : 'An error occurred.';
      return {
        id: dbMessage.id,
        type: 'error',
        data: { message: content },
        parentToolUseId: null,
      };
    } catch {
      return {
        id: dbMessage.id,
        type: 'error',
        data: { message: 'An error occurred.' },
        parentToolUseId: null,
      };
    }
  }
  // First, handle PokéCode canonical user input messages regardless of provider
  try {
    if (dbMessage.contentData) {
      const parsed = JSON.parse(dbMessage.contentData);
      const ok = PokeCodeUserMessageSchema.safeParse(parsed);
      if (ok.success) {
        return {
          id: dbMessage.id,
          type: 'user',
          data: { content: ok.data.content },
          parentToolUseId: null,
        };
      }
    }
  } catch {
    // fall through to provider-specific parsers
  }

  if (dbMessage.provider === 'codex-cli') {
    return parseCodexDbMessage(dbMessage, projectPath);
  }
  // default to Claude for legacy rows and explicit 'claude-code'
  return parseClaudeDbMessage(dbMessage, projectPath);
}
