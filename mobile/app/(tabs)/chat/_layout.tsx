import React from 'react';
import { Stack } from 'expo-router';
import { useUIStore } from '@/stores/uiStore';
import { lightTheme, darkTheme } from '@/constants/theme';
import { useColorScheme } from 'react-native';

export default function ChatLayout() {
  const colorScheme = useColorScheme();
  const { theme } = useUIStore();
  const isDark = theme === 'dark' || (theme === 'system' && colorScheme === 'dark');
  const currentTheme = isDark ? darkTheme : lightTheme;

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: currentTheme.colors.background,
        },
        headerTintColor: currentTheme.colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: {
          backgroundColor: currentTheme.colors.background,
        },
      }}
    >
      <Stack.Screen
        name="[sessionId]"
        options={{
          title: 'Chat',
        }}
      />
    </Stack>
  );
}