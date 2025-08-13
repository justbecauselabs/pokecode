export const lightTheme = {
  colors: {
    primary: '#0066CC',
    primaryDark: '#0052A3',
    primaryLight: '#3385FF',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    surfaceVariant: '#EBEBEB',
    text: '#000000',
    textSecondary: '#666666',
    textTertiary: '#999999',
    border: '#E0E0E0',
    borderLight: '#F0F0F0',
    card: '#FFFFFF',
    inputBackground: '#F8F8F8',
    error: '#DC3545',
    success: '#28A745',
    warning: '#FFC107',
    info: '#17A2B8',

    // Code syntax colors
    syntax: {
      keyword: '#0066CC',
      string: '#28A745',
      comment: '#999999',
      number: '#DC3545',
      function: '#6F42C1',
      variable: '#E36209',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  typography: {
    h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
    h2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
    h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
    h4: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
    body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
    bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
    code: { fontSize: 14, fontFamily: 'monospace', lineHeight: 20 },
  },
  borderRadius: {
    xs: 2,
    sm: 4,
    md: 8,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
    },
  },
} as const;

export const darkTheme = {
  ...lightTheme,
  colors: {
    ...lightTheme.colors,
    primary: '#4A9EFF',
    primaryDark: '#2E7FDB',
    primaryLight: '#6DB3FF',
    background: '#000000',
    surface: '#1A1A1A',
    surfaceVariant: '#2A2A2A',
    text: '#FFFFFF',
    textSecondary: '#CCCCCC',
    textTertiary: '#999999',
    border: '#333333',
    borderLight: '#2A2A2A',
    card: '#1A1A1A',
    inputBackground: '#2A2A2A',

    // Code syntax colors for dark mode
    syntax: {
      keyword: '#4A9EFF',
      string: '#5DD573',
      comment: '#999999',
      number: '#FF6B6B',
      function: '#B794F6',
      variable: '#FFA94D',
    },
  },
} as const;

export type Theme = typeof lightTheme;
export type ThemeColors = typeof lightTheme.colors;
