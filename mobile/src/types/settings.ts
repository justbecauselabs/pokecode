import type { ClaudeModel } from '@pokecode/api';

/**
 * Settings configuration types
 */
export interface AppSettings {
  /** Custom API base URL override */
  customApiBaseUrl?: string;
  /** Default Claude model for messages */
  defaultModel?: ClaudeModel;
}

export interface SettingsFormData {
  customApiBaseUrl: string;
  defaultModel: ClaudeModel;
}
