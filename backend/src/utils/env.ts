export function isTest(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.BUN_TEST === '1' ||
    typeof (globalThis as Record<string, unknown>).test !== 'undefined' ||
    process.argv.some((arg) => arg.includes('bun test') || arg.includes('test'))
  );
}
