import { type ClassValue, clsx } from 'clsx';

/**
 * Enhanced utility function to combine class names with conditional logic
 * Uses clsx for conditional classes with development-time validation
 */
export function cn(...inputs: ClassValue[]): string {
  const result = clsx(inputs);
  
  // Development-time validation to catch common mistakes
  if (__DEV__ && result) {
    // Warn about potential hardcoded colors (should use TailwindCSS tokens)
    if (result.includes('#')) {
      console.warn(`⚠️  Potential hardcoded color in className: "${result}". Consider using TailwindCSS color tokens instead.`);
    }
    
    // Warn about potential inline styling patterns
    if (result.includes('style') || result.includes('Style')) {
      console.warn(`⚠️  Potential style prop usage in className: "${result}". Use pure TailwindCSS classes instead.`);
    }
  }
  
  return result;
}

/**
 * Type-safe utility for combining predefined style patterns
 * Use this for component variants and common patterns
 */
export function cnSafe<T extends Record<string, string>>(
  patterns: T,
  key: keyof T,
  ...additionalClasses: ClassValue[]
): string {
  return cn(patterns[key], ...additionalClasses);
}
