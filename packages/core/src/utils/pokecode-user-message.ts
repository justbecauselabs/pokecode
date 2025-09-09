import { createId } from '@paralleldrive/cuid2';
import type { PokeCodeUserMessage } from '@pokecode/types';

export function createPokeCodeUserMessage(params: {
  content: string;
  id?: string;
  timestamp?: string;
}): PokeCodeUserMessage {
  const { content } = params;
  const id = params.id ?? createId();
  const timestamp = params.timestamp ?? new Date().toISOString();
  return {
    kind: 'pokecode_user_message',
    id,
    timestamp,
    role: 'user',
    content,
  };
}
