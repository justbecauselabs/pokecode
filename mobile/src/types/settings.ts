/**
 * Settings configuration types
 */
export interface AppSettings {
  /** Custom API base URL override */
  customApiBaseUrl?: string;
}

export interface SettingsFormData {
  customApiBaseUrl: string;
}