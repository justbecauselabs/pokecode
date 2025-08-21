import { z } from 'zod';

/**
 * Supported Claude models for Claude Code CLI
 */
export enum ClaudeModel {
  OPUS = 'opus',
  SONNET = 'sonnet',
  OPUS_PLAN = 'opus-plan',
}

export const ClaudeModelSchema = z.nativeEnum(ClaudeModel);

const modelNames: Record<ClaudeModel, string> = {
  [ClaudeModel.OPUS]: 'Claude Opus 4.1',
  [ClaudeModel.SONNET]: 'Claude Sonnet 4.1',
  [ClaudeModel.OPUS_PLAN]: 'Claude Opus 4.1 (Plan)',
};

/**
 * Array of all available Claude models
 */
export const CLAUDE_MODELS = Object.values(ClaudeModel);

/**
 * Get display name for a model
 */
export function getModelDisplayName(model: ClaudeModel): string {
  return modelNames[model];
}
