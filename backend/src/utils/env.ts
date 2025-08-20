import { config } from '@/config';

export function isTest(): boolean {
  return (
    config.NODE_ENV === 'test' ||
    config.BUN_TEST === '1' ||
    typeof (globalThis as Record<string, unknown>).test !== 'undefined' ||
    process.argv.some((arg) => arg.includes('bun test') || arg.includes('test'))
  );
}
