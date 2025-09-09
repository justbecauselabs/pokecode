import { z } from 'zod';

// Canonical, provider-agnostic shape for user-authored input messages
// Used for all providers (Claude Code, Codex CLI, etc.) when persisting user inputs
export const PokeCodeUserMessageSchema = z.object({
  kind: z.literal('pokecode_user_message'),
  id: z.string(),
  timestamp: z.string().datetime(),
  role: z.literal('user'),
  content: z.string().min(1),
});

export type PokeCodeUserMessage = z.infer<typeof PokeCodeUserMessageSchema>;

export function isPokeCodeUserMessage(v: unknown): v is PokeCodeUserMessage {
  return PokeCodeUserMessageSchema.safeParse(v).success;
}
