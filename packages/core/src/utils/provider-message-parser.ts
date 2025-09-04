import type { Message } from '@pokecode/types';
import type { SessionMessage } from '../database/schema-sqlite/session_messages';
import { parseClaudeDbMessage } from './claude-code-message-parser';
import { parseCodexDbMessage } from './codex-message-parser';

export function parseDbMessageByProvider(
  dbMessage: SessionMessage,
  projectPath?: string,
): Message | null {
  if (dbMessage.provider === 'codex-cli') {
    return parseCodexDbMessage(dbMessage, projectPath);
  }
  // default to Claude for legacy rows and explicit 'claude-code'
  return parseClaudeDbMessage(dbMessage, projectPath);
}
