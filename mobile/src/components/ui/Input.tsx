import type React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  useColorScheme,
  View,
  type ViewStyle,
} from 'react-native';
import { darkTheme, lightTheme } from '@/constants/theme';
import { useUIStore } from '@/stores/uiStore';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({ label, error, containerStyle, style, ...props }) => {
  const colorScheme = useColorScheme();
  const { theme } = useUIStore();
  const isDark = theme === 'dark' || (theme === 'system' && colorScheme === 'dark');
  const currentTheme = isDark ? darkTheme : lightTheme;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: currentTheme.colors.text }]}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: currentTheme.colors.inputBackground,
            color: currentTheme.colors.text,
            borderColor: error ? currentTheme.colors.error : currentTheme.colors.border,
          },
          style,
        ]}
        placeholderTextColor={currentTheme.colors.textTertiary}
        {...props}
      />
      {error && <Text style={[styles.error, { color: currentTheme.colors.error }]}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  error: {
    fontSize: 12,
    marginTop: 4,
  },
});
