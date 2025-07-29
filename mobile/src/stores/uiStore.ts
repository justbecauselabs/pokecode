import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'system';

interface UIStore {
  theme: ThemeMode;
  fontSize: number;
  syntaxTheme: string;
  showLineNumbers: boolean;
  wordWrap: boolean;
  
  // Actions
  setTheme: (theme: ThemeMode) => void;
  setFontSize: (size: number) => void;
  setSyntaxTheme: (theme: string) => void;
  toggleLineNumbers: () => void;
  toggleWordWrap: () => void;
  
  // Computed
  isDark: () => boolean;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      theme: 'system',
      fontSize: 14,
      syntaxTheme: 'github',
      showLineNumbers: true,
      wordWrap: true,

      setTheme: (theme: ThemeMode) => set({ theme }),
      
      setFontSize: (size: number) => {
        const clampedSize = Math.max(10, Math.min(24, size));
        set({ fontSize: clampedSize });
      },
      
      setSyntaxTheme: (theme: string) => set({ syntaxTheme: theme }),
      
      toggleLineNumbers: () => set((state) => ({ showLineNumbers: !state.showLineNumbers })),
      
      toggleWordWrap: () => set((state) => ({ wordWrap: !state.wordWrap })),
      
      isDark: () => {
        const state = get();
        if (state.theme === 'system') {
          const colorScheme = useColorScheme();
          return colorScheme === 'dark';
        }
        return state.theme === 'dark';
      },
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);