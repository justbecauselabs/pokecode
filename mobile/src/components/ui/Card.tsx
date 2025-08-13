import type React from 'react';
import { StyleSheet, TouchableOpacity, useColorScheme, View, type ViewStyle } from 'react-native';
import { darkTheme, lightTheme } from '@/constants/theme';
import { useUIStore } from '@/stores/uiStore';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: 'none' | 'small' | 'medium' | 'large';
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, style, padding = 'medium', onPress }) => {
  const colorScheme = useColorScheme();
  const { theme } = useUIStore();
  const isDark = theme === 'dark' || (theme === 'system' && colorScheme === 'dark');
  const currentTheme = isDark ? darkTheme : lightTheme;

  const getPaddingStyle = (): ViewStyle => {
    switch (padding) {
      case 'none':
        return {};
      case 'small':
        return { padding: currentTheme.spacing.sm };
      case 'medium':
        return { padding: currentTheme.spacing.md };
      case 'large':
        return { padding: currentTheme.spacing.lg };
    }
  };

  const cardContent = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: currentTheme.colors.card,
          shadowColor: isDark ? '#000' : '#000',
        },
        getPaddingStyle(),
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        {cardContent}
      </TouchableOpacity>
    );
  }

  return cardContent;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
