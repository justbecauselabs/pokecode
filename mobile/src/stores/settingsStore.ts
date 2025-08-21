import { ClaudeModel, type ClaudeModel as ClaudeModelType } from '@pokecode/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AppSettings } from '../types/settings';

interface SettingsStore extends AppSettings {
  // Actions
  setCustomApiBaseUrl: (url: string | undefined) => void;
  setDefaultModel: (model: ClaudeModelType | undefined) => void;
  resetSettings: () => void;
}

const defaultSettings: AppSettings = {
  customApiBaseUrl: undefined,
  defaultModel: ClaudeModel.SONNET,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setCustomApiBaseUrl: (customApiBaseUrl: string | undefined) =>
        set({ customApiBaseUrl: customApiBaseUrl || undefined }),

      setDefaultModel: (defaultModel: ClaudeModelType | undefined) =>
        set({ defaultModel: defaultModel || ClaudeModel.SONNET }),

      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'app-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/**
 * Hook to get the effective API base URL
 * Returns custom URL if set, otherwise undefined (uses default)
 */
export function useApiBaseUrl(): string | undefined {
  const { customApiBaseUrl } = useSettingsStore();
  return customApiBaseUrl;
}

/**
 * Hook to get the default model for new sessions
 * Returns the user's preferred default model
 */
export function useDefaultModel(): ClaudeModelType {
  const { defaultModel } = useSettingsStore();
  return defaultModel || ClaudeModel.SONNET;
}
