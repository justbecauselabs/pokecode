import { darkTheme } from '../../constants/theme';

// Message type styling configuration using theme constants
export const MESSAGE_TYPE_STYLES = {
  user: {
    background: '', // No background (transparent)
    backgroundColor: 'transparent',
    textColor: darkTheme.colors.textSecondary,
    headerTextColor: darkTheme.colors.textSecondary
  },
  assistant: {
    background: 'bg-gray-900',
    backgroundColor: darkTheme.colors.surface,
    textColor: darkTheme.colors.textSecondary,
    headerTextColor: darkTheme.colors.text
  },
  system: {
    background: 'bg-yellow-600',
    backgroundColor: darkTheme.colors.warning,
    textColor: darkTheme.colors.text,
    headerTextColor: darkTheme.colors.text
  },
  result: {
    background: 'bg-green-600',
    backgroundColor: darkTheme.colors.success,
    textColor: darkTheme.colors.text,
    headerTextColor: darkTheme.colors.text
  }
} as const;

export type MessageType = keyof typeof MESSAGE_TYPE_STYLES;