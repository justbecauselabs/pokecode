/**
 * Settings configuration types
 */
export interface AppSettings {
  /** Custom API base URL override */
  customApiBaseUrl?: string;
  /** Default Claude model for messages */
  defaultModel?: string;
}

export interface SettingsFormData {
  customApiBaseUrl: string;
  defaultModel: string;
}
