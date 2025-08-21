/**
 * Minimal process spawn helper for daemonizing the server.
 */

export const spawnDetached = (
  runtimePath: string,
  args: string[],
  options: {
    cwd?: string;
    env?: Record<string, string>;
    stdout?: string;
    stderr?: string;
  } = {},
): Bun.Subprocess => {
  const env: Record<string, string> = {
    ...process.env,
    ...(options.env ?? {}),
  } as Record<string, string>;

  const proc =
    options.stdout || options.stderr
      ? Bun.spawn([runtimePath, ...args], {
          env,
          ...(options.cwd && { cwd: options.cwd }),
          stdout: options.stdout ? Bun.file(options.stdout) : 'inherit',
          stderr: options.stderr ? Bun.file(options.stderr) : 'inherit',
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
