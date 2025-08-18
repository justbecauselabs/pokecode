import React, { type ReactNode } from 'react';
import { Text } from 'react-native';

/**
 * Utility functions to prevent "strings must be rendered in text component" errors
 */

/**
 * Type guard to check if a value is renderable text content
 */
export function isTextContent(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number';
}

/**
 * Safely renders content, automatically wrapping strings/numbers in Text components
 */
export function safeRender(content: ReactNode): ReactNode {
  if (isTextContent(content)) {
    return <Text>{content}</Text>;
  }
  return content;
}

/**
 * Safe array renderer that wraps string/number items in Text components
 */
export function safeRenderArray(items: unknown[]): ReactNode[] {
  return items.map((item, index) => {
    if (isTextContent(item)) {
      return <Text key={index}>{item}</Text>;
    }
    return item as ReactNode;
  });
}

/**
 * Hook to safely render conditional content
 */
export function useSafeConditionalRender(
  condition: boolean,
  truthyContent: ReactNode,
  falsyContent?: ReactNode
): ReactNode {
  const content = condition ? truthyContent : falsyContent;
  return safeRender(content);
}

/**
 * Safe template for dynamic content that might be strings
 */
export function SafeTemplate({ 
  content, 
  fallback = null 
}: { 
  content: unknown; 
  fallback?: ReactNode;
}): ReactNode {
  if (content === null || content === undefined) {
    return fallback;
  }
  
  if (isTextContent(content)) {
    return <Text>{content}</Text>;
  }
  
  return content as ReactNode;
}

/**
 * Development-only runtime checker (strip in production)
 */
export function validateNoRawText(content: ReactNode, componentName: string): void {
  if (__DEV__ && isTextContent(content)) {
    console.error(
      `⚠️  Raw text detected in ${componentName}: "${content}". ` +
      'Wrap strings in <Text> components to prevent React Native rendering errors.'
    );
  }
}