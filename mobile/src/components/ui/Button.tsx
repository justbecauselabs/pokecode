import type React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  type TextStyle,
  TouchableOpacity,
  type TouchableOpacityProps,
  useColorScheme,
  type ViewStyle,
} from 'react-native';
import { darkTheme, lightTheme } from '@/constants/theme';
import { useUIStore } from '@/stores/uiStore';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'medium',
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  style,
  ...props
}) => {
  const colorScheme = useColorScheme();
  const { theme } = useUIStore();
  const isDark = theme === 'dark' || (theme === 'system' && colorScheme === 'dark');
  const currentTheme = isDark ? darkTheme : lightTheme;

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: currentTheme.colors.primary,
          borderColor: currentTheme.colors.primary,
        };
      case 'secondary':
        return {
          backgroundColor: 'transparent',
          borderColor: currentTheme.colors.primary,
          borderWidth: 1,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
        };
      case 'danger':
        return {
          backgroundColor: currentTheme.colors.error,
          borderColor: currentTheme.colors.error,
        };
    }
  };

  const getSizeStyles = (): ViewStyle => {
    switch (size) {
      case 'small':
        return {
          paddingHorizontal: currentTheme.spacing.sm,
          paddingVertical: currentTheme.spacing.xs,
          minHeight: 32,
        };
      case 'medium':
        return {
          paddingHorizontal: currentTheme.spacing.md,
          paddingVertical: currentTheme.spacing.sm,
          minHeight: 44,
        };
      case 'large':
        return {
          paddingHorizontal: currentTheme.spacing.lg,
          paddingVertical: currentTheme.spacing.md,
          minHeight: 56,
        };
    }
  };

  const getTextColor = (): string => {
    if (variant === 'secondary' || variant === 'ghost') {
      return currentTheme.colors.primary;
    }
    return '#FFFFFF';
  };

  const getTextSize = (): TextStyle => {
    switch (size) {
      case 'small':
        return currentTheme.typography.bodySmall;
      case 'medium':
        return currentTheme.typography.body;
      case 'large':
        return { ...currentTheme.typography.body, fontSize: 18 };
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getVariantStyles(),
        getSizeStyles(),
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {icon && <>{icon}</>}
          <Text
            style={[
              styles.text,
              getTextSize(),
              { color: getTextColor() },
              icon ? styles.textWithIcon : undefined,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    fontWeight: '600',
  },
  textWithIcon: {
    marginLeft: 8,
  },
});
