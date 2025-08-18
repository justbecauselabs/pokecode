import { ReactNode } from 'react';

/**
 * Type-safe React Native component props that prevent string rendering errors
 */

// Override React Native's View to prevent direct string children
declare module 'react-native' {
  interface ViewProps {
    children?: Exclude<ReactNode, string | number | boolean> | undefined;
  }
  
  interface PressableProps {
    children?: Exclude<ReactNode, string | number | boolean> | undefined;
  }
  
  interface ScrollViewProps {
    children?: Exclude<ReactNode, string | number | boolean> | undefined;
  }
  
  interface SafeAreaViewProps {
    children?: Exclude<ReactNode, string | number | boolean> | undefined;
  }
}

/**
 * Utility types for safe React Native development
 */
export type SafeReactNode = Exclude<ReactNode, string | number | boolean>;

export type TextContent = string | number | boolean | null | undefined;

/**
 * Ensures content is safe for non-Text components
 */
export type SafeChildren = SafeReactNode | SafeReactNode[];

/**
 * Type guard to check if content needs Text wrapper
 */
export function isTextContent(content: unknown): content is TextContent {
  return typeof content === 'string' || 
         typeof content === 'number' || 
         typeof content === 'boolean';
}

/**
 * Type-safe wrapper that forces Text component usage for strings
 */
export type RequireTextWrapper<T> = T extends string | number | boolean 
  ? never 
  : T;