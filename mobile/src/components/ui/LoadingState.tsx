import type React from 'react';
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { darkTheme, lightTheme } from '@/constants/theme';
import { useUIStore } from '@/stores/uiStore';

interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'large';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  size = 'large',
}) => {
  const colorScheme = useColorScheme();
  const { theme } = useUIStore();
  const isDark = theme === 'dark' || (theme === 'system' && colorScheme === 'dark');
  const currentTheme = isDark ? darkTheme : lightTheme;

  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={currentTheme.colors.primary} />
      {message && (
        <Text style={[styles.message, { color: currentTheme.colors.textSecondary }]}>
          {message}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
});
