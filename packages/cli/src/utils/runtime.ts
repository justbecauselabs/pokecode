/**
 * Runtime detection and management utilities
 */

import { which } from './which.js';
import { platform } from 'node:os';

export interface RuntimeInfo {
  runtime: 'node' | 'bun';
  version: string;
  path: string;
}

export const detectRuntime = async (): Promise<RuntimeInfo> => {
  // Check for Bun first (preferred)
  try {
    const bunPath = await which('bun');
    if (bunPath) {
      const version = await getVersion(bunPath, ['--version']);
      return {
        runtime: 'bun',
        version,
        path: bunPath
      };
    }
  } catch {
    // Bun not available, fall back to Node
  }

  // Fallback to Node.js
  try {
    const nodePath = await which('node');
    if (nodePath) {
      const version = await getVersion(nodePath, ['--version']);
      return {
        runtime: 'node',
        version: version.replace('v', ''),
        path: nodePath
      };
    }
  } catch {
    // This should never happen since we're running in Node
  }

  throw new Error('No suitable runtime found (Node.js or Bun)');
};

const getVersion = async (runtimePath: string, args: string[]): Promise<string> => {
  try {
    const proc = Bun.spawn([runtimePath, ...args], {
      stdout: 'pipe',
      stderr: 'ignore',
      stdin: 'ignore'
    });
    
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    
    if (proc.exitCode === 0) {
      return output.trim();
    } else {
      throw new Error(`Failed to get version, exit code: ${proc.exitCode}`);
    }
  } catch (error) {
    throw new Error(`Failed to get version: ${error}`);
  }
};

export const spawnDetached = (
  runtimePath: string, 
  args: string[], 
  options: {
    cwd?: string;
    env?: Record<string, string>;
    stdout?: string;
    stderr?: string;
  } = {}
): Bun.Subprocess => {
  // Create output files for stdout/stderr if specified
  const spawnOptions: any = {
    env: {
      ...process.env,
      ...options.env
    }
  };
  
  if (options.cwd) {
    spawnOptions.cwd = options.cwd;
  }
  
  // Redirect output to files or /dev/null for true detachment
  if (options.stdout || options.stderr) {
    spawnOptions.stdout = options.stdout ? Bun.file(options.stdout) : 'inherit';
    spawnOptions.stderr = options.stderr ? Bun.file(options.stderr) : 'inherit';
    spawnOptions.stdin = 'ignore';
  } else {
    // For true daemon mode, redirect to /dev/null
    spawnOptions.stdio = ['ignore', 'inherit', 'inherit'];
  }
  
  const proc = Bun.spawn([runtimePath, ...args], spawnOptions);
  
  // Immediately unref the process to allow parent to exit
  if (proc.pid) {
    // On Unix-like systems, we can use process.kill with signal 0 to check if process exists
    // This doesn't actually send a kill signal, just checks existence
    process.nextTick(() => {
      try {
        // Detach from parent by not waiting for the child
        proc.unref?.();
      } catch {
        // unref might not be available, that's OK
      }
    });
  }
  
  return proc;
};