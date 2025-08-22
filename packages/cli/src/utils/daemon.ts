/**
 * Cross-platform daemon management utilities
 */

import { getConfig } from '@pokecode/core';

export interface DaemonInfo {
  pid: number;
  port: number;
  host: string;
  startTime: string;
}

export class DaemonManager {
  async saveDaemonInfo(info: DaemonInfo): Promise<void> {
    const config = await getConfig();

    // Write PID file with secure permissions (0o600 = owner read/write only)
    await Bun.write(config.pidFile, info.pid.toString());
    await Bun.$`chmod 600 ${config.pidFile}`;

    // Write full daemon info with secure permissions
    await Bun.write(config.daemonFile, JSON.stringify(info, null, 2));
    await Bun.$`chmod 600 ${config.daemonFile}`;
  }

  async getDaemonInfo(): Promise<DaemonInfo | null> {
    try {
      const config = await getConfig();
      const file = Bun.file(config.daemonFile);
      if (await file.exists()) {
        const content = await file.text();
        return JSON.parse(content);
      }
      return null;
    } catch {
      return null;
    }
  }

  async getPid(): Promise<number | null> {
    try {
      const config = await getConfig();
      const file = Bun.file(config.pidFile);
      if (await file.exists()) {
        const content = await file.text();
        const pid = parseInt(content.trim(), 10);
        return Number.isNaN(pid) ? null : pid;
      }
      return null;
    } catch {
      return null;
    }
  }

  async isRunning(): Promise<boolean> {
    const pid = await this.getPid();
    if (!pid) return false;

    try {
      // Send signal 0 to check if process exists
      process.kill(pid, 0);

      // Additional validation: check if it's actually our process
      return await this.validateProcess(pid);
    } catch {
      // Process doesn't exist, clean up stale PID file
      await this.cleanup();
      return false;
    }
  }

  private async validateProcess(pid: number): Promise<boolean> {
    try {
      // On Unix-like systems, try to read process info to verify it's our server
      if (process.platform !== 'win32') {
        try {
          const file = Bun.file(`/proc/${pid}/cmdline`);
          if (await file.exists()) {
            const cmdline = await file.text();
            // Check if the process command line contains our server entry
            return cmdline.includes('pokecode') || cmdline.includes('server-entry');
          }
          // If we can't read proc info, assume it's valid (process exists)
          return true;
        } catch {
          // If we can't read proc info, assume it's valid (process exists)
          return true;
        }
      }

      // On Windows or if validation fails, assume process is valid if it exists
      return true;
    } catch {
      return false;
    }
  }

  async stop(force = false): Promise<boolean> {
    const pid = await this.getPid();
    if (!pid) return false;

    try {
      const signal = force ? 'SIGKILL' : 'SIGTERM';
      process.kill(pid, signal);

      // Wait a bit for graceful shutdown
      if (!force) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Check if it's still running
        try {
          process.kill(pid, 0);
          // Still running, force kill
          process.kill(pid, 'SIGKILL');
        } catch {
          // Already stopped
        }
      }

      await this.cleanup();
      return true;
    } catch (_error) {
      // Process might not exist
      await this.cleanup();
      return false;
    }
  }

  async cleanup(): Promise<void> {
    try {
      const config = await getConfig();
      const pidFileObj = Bun.file(config.pidFile);
      if (await pidFileObj.exists()) {
        await Bun.$`rm ${config.pidFile}`;
      }
    } catch {
      // File might not exist
    }

    try {
      const config = await getConfig();
      const file = Bun.file(config.daemonFile);
      if (await file.exists()) {
        await Bun.$`rm ${config.daemonFile}`;
      }
    } catch {
      // File might not exist
    }
  }
}
