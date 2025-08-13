import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AppSettings } from '../types/settings';

interface SettingsStore extends AppSettings {
  // Actions
  setCustomApiBaseUrl: (url: string | undefined) => void;
  resetSettings: () => void;
}

const defaultSettings: AppSettings = {
  customApiBaseUrl: undefined,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setCustomApiBaseUrl: (customApiBaseUrl: string | undefined) =>
        set({ customApiBaseUrl: customApiBaseUrl || undefined }),

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
