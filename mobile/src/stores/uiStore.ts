import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type ThemeMode = 'light' | 'dark' | 'system';

interface UIStore {
  theme: ThemeMode;

  // Actions
  setTheme: (theme: ThemeMode) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      theme: 'system',

      setTheme: (theme: ThemeMode) => set({ theme }),
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/**
 * Hook that bridges the persisted theme preference with NativeWind's color scheme
 */
export function useTheme() {
  const { theme, setTheme } = useUIStore();
  const { setColorScheme } = useNativeWindColorScheme();

  // Sync theme changes with NativeWind - always use dark for One Dark Pro
  useEffect(() => {
    // For now, force dark mode to use One Dark Pro colors consistently
    setColorScheme('dark');
  }, [setColorScheme]);

  const actualTheme = 'dark'; // Always use dark for One Dark Pro theme

  return {
    theme,
    setTheme,
    colorScheme: 'dark',
    actualTheme,
    isDark: true,
  };
}
