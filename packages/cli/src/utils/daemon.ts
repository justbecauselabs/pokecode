/**
 * Cross-platform daemon management utilities
 */

import { DAEMON_FILE, PID_FILE } from '@pokecode/core';

export interface DaemonInfo {
  pid: number;
  port: number;
  host: string;
  startTime: string;
}

export class DaemonManager {
  async saveDaemonInfo(info: DaemonInfo): Promise<void> {
    // Write PID file with secure permissions (0o600 = owner read/write only)
    await Bun.write(PID_FILE, info.pid.toString());
    await Bun.$`chmod 600 ${PID_FILE}`;

    // Write full daemon info with secure permissions
    await Bun.write(DAEMON_FILE, JSON.stringify(info, null, 2));
    await Bun.$`chmod 600 ${DAEMON_FILE}`;
  }

  async getDaemonInfo(): Promise<DaemonInfo | null> {
    try {
      const file = Bun.file(DAEMON_FILE);
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
      const file = Bun.file(PID_FILE);
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
      const pidFileObj = Bun.file(PID_FILE);
      if (await pidFileObj.exists()) {
        await Bun.$`rm ${PID_FILE}`;
      }
    } catch {
      // File might not exist
    }

    try {
      const file = Bun.file(DAEMON_FILE);
      if (await file.exists()) {
        await Bun.$`rm ${DAEMON_FILE}`;
      }
    } catch {
      // File might not exist
    }
  }
}
