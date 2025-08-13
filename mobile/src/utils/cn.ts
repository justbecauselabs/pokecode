import { type ClassValue, clsx } from 'clsx';

/**
 * Utility function to combine class names with conditional logic
 * Uses clsx for conditional classes
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
