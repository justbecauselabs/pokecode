/**
 * Supported Claude models for Claude Code CLI
 */
export const CLAUDE_MODELS = [
  'opus',
  'sonnet', 
  'claude-opus-4-20250805',
  'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
] as const;

export type ClaudeModel = typeof CLAUDE_MODELS[number];

/**
 * Check if a model ID is valid
 */
export function isValidModel(id: string): id is ClaudeModel {
  return CLAUDE_MODELS.includes(id as ClaudeModel);
}

/**
 * Get display name for a model
 */
export function getModelDisplayName(id: string): string {
  const modelNames: Record<string, string> = {
    'opus': 'Claude Opus 4',
    'sonnet': 'Claude Sonnet 4',
    'claude-opus-4-20250805': 'Claude Opus 4 (20250805)',
    'claude-sonnet-4-20250514': 'Claude Sonnet 4 (20250514)', 
    'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
    'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
  };
  return modelNames[id] || id;
}

/**
 * Default model ID
 */
export const DEFAULT_MODEL: ClaudeModel = 'sonnet';