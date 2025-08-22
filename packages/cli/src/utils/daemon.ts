/**
 * Cross-platform daemon management utilities
 */

import { join } from 'node:path';
import { getConfig } from '@pokecode/core';

export interface DaemonInfo {
  pid: number;
  port: number;
  host: string;
  startTime: string;
  dataDir: string;
  logFile: string;
}

export class DaemonManager {
  private pidFile: string;
  private logFile: string;
  private configFile: string;

  private async ensurePaths() {
    const config = await getConfig();
    this.pidFile = join(config.configDir, 'pokecode.pid');
    this.logFile = join(config.configDir, 'pokecode.log');
    this.configFile = join(config.configDir, 'config.json');
  }

  private async getInitializedConfigDir(): Promise<string> {
    await this.ensurePaths();
    if (!this.configDir) {
      throw new Error('Config directory not initialized');
    }
    return this.configDir;
  }

  private async getInitializedPidFile(): Promise<string> {
    await this.ensurePaths();
    if (!this.pidFile) {
      throw new Error('PID file path not initialized');
    }
    return this.pidFile;
  }

  private async getInitializedLogFile(): Promise<string> {
    await this.ensurePaths();
    if (!this.logFile) {
      throw new Error('Log file path not initialized');
    }
    return this.logFile;
  }

  private async getInitializedConfigFile(): Promise<string> {
    await this.ensurePaths();
    if (!this.configFile) {
      throw new Error('Config file path not initialized');
    }
    return this.configFile;
  }

  async ensureConfigDir(): Promise<void> {
    const configDir = await this.getInitializedConfigDir();
    const dir = Bun.file(configDir);
    if (!(await dir.exists())) {
      await Bun.$`mkdir -p ${configDir}`;
    }
  }

  async saveDaemonInfo(info: DaemonInfo): Promise<void> {
    await this.ensureConfigDir();

    const pidFile = await this.getInitializedPidFile();
    const configDir = await this.getInitializedConfigDir();

    // Write PID file with secure permissions (0o600 = owner read/write only)
    await Bun.write(pidFile, info.pid.toString());
    await Bun.$`chmod 600 ${pidFile}`;

    // Write full daemon info with secure permissions
    const infoFile = join(configDir, 'daemon.json');
    await Bun.write(infoFile, JSON.stringify(info, null, 2));
    await Bun.$`chmod 600 ${infoFile}`;
  }

  async getDaemonInfo(): Promise<DaemonInfo | null> {
    try {
      const configDir = await this.getInitializedConfigDir();
      const infoFile = join(configDir, 'daemon.json');
      const file = Bun.file(infoFile);
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
      const pidFile = await this.getInitializedPidFile();
      const file = Bun.file(pidFile);
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
      const pidFile = await this.getInitializedPidFile();
      const pidFileObj = Bun.file(pidFile);
      if (await pidFileObj.exists()) {
        await Bun.$`rm ${pidFile}`;
      }
    } catch {
      // File might not exist
    }

    try {
      const configDir = await this.getInitializedConfigDir();
      const infoFile = join(configDir, 'daemon.json');
      const file = Bun.file(infoFile);
      if (await file.exists()) {
        await Bun.$`rm ${infoFile}`;
      }
    } catch {
      // File might not exist
    }
  }

  async getLogFile(): Promise<string> {
    return await this.getInitializedLogFile();
  }

  async getConfigFile(): Promise<string> {
    return await this.getInitializedConfigFile();
  }

  async getConfigDir(): Promise<string> {
    return await this.getInitializedConfigDir();
  }
}
