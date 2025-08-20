/**
 * TailwindCSS Utility Patterns for consistent styling
 * This replaces hardcoded colors and theme constants
 */

// Message type styling patterns
export const messageTypeStyles = {
  user: 'border-l-4 border-l-message-user bg-background',
  assistant: 'border-l-4 border-l-message-assistant bg-background',
  system: 'border-l-4 border-l-message-system bg-background',
  result: 'border-l-4 border-l-message-result bg-background',
  error: 'border-l-4 border-l-destructive bg-background',
} as const;

// Typography patterns - replaces all hardcoded font families and inline styles
export const textStyles = {
  // Headers and labels
  header: 'font-mono text-header font-semibold text-muted-foreground uppercase tracking-wider',

  // Message content
  messageContent: 'font-mono text-message text-foreground',
  messageContentSm: 'font-mono text-message-sm text-foreground',

  // Error and status text
  error: 'font-mono text-message text-destructive',
  errorLarge: 'font-mono text-lg text-destructive',

  // Code styling
  code: 'font-mono text-code text-syntax-string bg-card rounded px-1',
  codeBlock: 'font-mono text-code text-foreground bg-card rounded-message p-3',

  // Interactive text
  link: 'font-mono text-message text-primary underline',
  linkHover: 'font-mono text-message text-primary-light underline',
} as const;

// Button variants - replaces hardcoded colors in Button component
export const buttonVariants = {
  primary: 'bg-primary text-primary-foreground border border-primary',
  secondary: 'bg-transparent text-primary border border-primary',
  ghost: 'bg-transparent text-primary border border-transparent',
  destructive: 'bg-destructive text-destructive-foreground border border-destructive',
} as const;

// Button sizes
export const buttonSizes = {
  small: 'px-2 py-1 min-h-button-sm',
  medium: 'px-4 py-2 min-h-button',
  large: 'px-6 py-4 min-h-button-lg',
} as const;

// Card variants - replaces card styling patterns
export const cardVariants = {
  default: 'bg-card rounded-xl shadow-lg',
  message: 'bg-background rounded-message',
  tool: 'bg-card rounded-tool border border-border',
  flat: 'bg-card rounded-md',
} as const;

// Card padding variants
export const cardPadding = {
  none: '',
  small: 'p-2',
  medium: 'p-4',
  large: 'p-6',
} as const;

// Input variants - replaces hardcoded placeholder colors
export const inputVariants = {
  default:
    'bg-input border border-border rounded-md px-3 py-2 min-h-input text-foreground placeholder:text-muted-foreground',
  error:
    'bg-input border border-destructive rounded-md px-3 py-2 min-h-input text-foreground placeholder:text-muted-foreground',
  focused:
    'bg-input border border-ring rounded-md px-3 py-2 min-h-input text-foreground placeholder:text-muted-foreground',
} as const;

// Status indicator colors - replaces hardcoded status colors
export const statusStyles = {
  online: 'text-indicator-success',
  offline: 'text-indicator-offline',
  away: 'text-indicator-warning',
  busy: 'text-indicator-error',
  loading: 'text-indicator-loading',
} as const;

// Activity indicator colors - replaces all hardcoded ActivityIndicator colors
export const indicatorColors = {
  primary: '#528bff', // text-indicator-primary
  loading: '#6366f1', // text-indicator-loading
  success: '#22c55e', // text-indicator-success
  warning: '#f59e0b', // text-indicator-warning
  error: '#ef4444', // text-indicator-error
  offline: '#94a3b8', // text-indicator-offline
  destructive: '#abb2bf', // text-destructive-foreground
  primaryForeground: '#282c34', // text-primary-foreground
} as const;

// Background colors - replaces all hardcoded background colors
export const backgroundColors = {
  background: '#282c34', // bg-background
  foreground: '#abb2bf', // bg-foreground/text-foreground equivalent
  card: '#21252b', // bg-card
  muted: '#9ca3af', // bg-muted/text-muted-foreground
} as const;

// Common layout patterns
export const layoutStyles = {
  flexCenter: 'flex items-center justify-center',
  flexRow: 'flex-row items-center',
  flexCol: 'flex-col',
  fullWidth: 'w-full',
  fullHeight: 'h-full',
  flex1: 'flex-1',
} as const;

// Spacing patterns
export const spacingStyles = {
  messagePadding: 'p-3',
  sectionSpacing: 'mb-section',
  messageSpacing: 'mb-message',
  compactSpacing: 'mb-2',
} as const;

// Shadow patterns
export const shadowStyles = {
  small: 'shadow-sm',
  medium: 'shadow-md',
  large: 'shadow-lg',
  none: 'shadow-none',
} as const;

// Type definitions for type safety
export type MessageType = keyof typeof messageTypeStyles;
export type TextStyle = keyof typeof textStyles;
export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = keyof typeof buttonSizes;
export type CardVariant = keyof typeof cardVariants;
export type CardPadding = keyof typeof cardPadding;
export type InputVariant = keyof typeof inputVariants;
export type StatusStyle = keyof typeof statusStyles;
export type IndicatorColor = keyof typeof indicatorColors;
