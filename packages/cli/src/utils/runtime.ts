/**
 * Minimal process spawn helper for daemonizing the server.
 */

export const spawnDetached = (
  runtimePath: string,
  args: string[],
  options: {
    cwd?: string;
    env?: Record<string, string>;
    stdout?: string | 'inherit' | 'ignore';
    stderr?: string | 'inherit' | 'ignore';
  } = {},
): Bun.Subprocess => {
  const env: Record<string, string> = {
    ...process.env,
    ...(options.env ?? {}),
  } as Record<string, string>;

  const useCustom = options.stdout !== undefined || options.stderr !== undefined;
  const proc = useCustom
    ? Bun.spawn([runtimePath, ...args], {
        env,
        ...(options.cwd && { cwd: options.cwd }),
        stdout: typeof options.stdout === 'string' && options.stdout !== 'inherit' && options.stdout !== 'ignore'
          ? Bun.file(options.stdout)
          : (options.stdout ?? 'inherit'),
        stderr: typeof options.stderr === 'string' && options.stderr !== 'inherit' && options.stderr !== 'ignore'
          ? Bun.file(options.stderr)
          : (options.stderr ?? 'inherit'),
        stdin: 'ignore',
      })
    : Bun.spawn([runtimePath, ...args], {
        env,
        ...(options.cwd && { cwd: options.cwd }),
        stdio: ['ignore', 'inherit', 'inherit'] as const,
      });

  if (proc.pid) {
    process.nextTick(() => {
      try {
        proc.unref?.();
      } catch {
        // ignore
      }
    });
  }

  return proc;
};
