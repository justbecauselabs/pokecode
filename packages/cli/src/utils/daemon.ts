/**
 * Cross-platform daemon management utilities
 */

import { join } from 'node:path';
import { homedir, platform } from 'node:os';

export interface DaemonInfo {
  pid: number;
  port: number;
  host: string;
  startTime: string;
  dataDir: string;
  logFile: string;
}

export class DaemonManager {
  private readonly configDir: string;
  private readonly pidFile: string;
  private readonly logFile: string;
  private readonly configFile: string;

  constructor() {
    // Use appropriate config directory for each platform
    this.configDir = this.getBaseConfigDir();
    this.pidFile = join(this.configDir, 'pokecode.pid');
    this.logFile = join(this.configDir, 'pokecode.log');
    this.configFile = join(this.configDir, 'config.json');
  }

  private getBaseConfigDir(): string {
    const isWindows = platform() === 'win32';
    
    if (isWindows) {
      return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'pokecode');
    } else {
      return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'pokecode');
    }
  }

  async ensureConfigDir(): Promise<void> {
    const dir = Bun.file(this.configDir);
    if (!(await dir.exists())) {
      await Bun.$`mkdir -p ${this.configDir}`;
    }
  }

  async saveDaemonInfo(info: DaemonInfo): Promise<void> {
    await this.ensureConfigDir();
    
    // Write PID file with secure permissions (0o600 = owner read/write only)
    await Bun.write(this.pidFile, info.pid.toString());
    await Bun.$`chmod 600 ${this.pidFile}`;
    
    // Write full daemon info with secure permissions
    const infoFile = join(this.configDir, 'daemon.json');
    await Bun.write(infoFile, JSON.stringify(info, null, 2));
    await Bun.$`chmod 600 ${infoFile}`;
  }

  async getDaemonInfo(): Promise<DaemonInfo | null> {
    try {
      const infoFile = join(this.configDir, 'daemon.json');
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
      const file = Bun.file(this.pidFile);
      if (await file.exists()) {
        const content = await file.text();
        const pid = parseInt(content.trim(), 10);
        return isNaN(pid) ? null : pid;
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
        await new Promise(resolve => setTimeout(resolve, 2000));
        
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
    } catch (error) {
      // Process might not exist
      await this.cleanup();
      return false;
    }
  }

  async cleanup(): Promise<void> {
    try {
      const pidFile = Bun.file(this.pidFile);
      if (await pidFile.exists()) {
        await Bun.$`rm ${this.pidFile}`;
      }
    } catch {
      // File might not exist
    }
    
    try {
      const infoFile = join(this.configDir, 'daemon.json');
      const file = Bun.file(infoFile);
      if (await file.exists()) {
        await Bun.$`rm ${infoFile}`;
      }
    } catch {
      // File might not exist
    }
  }

  getLogFile(): string {
    return this.logFile;
  }

  getConfigFile(): string {
    return this.configFile;
  }

  getConfigDir(): string {
    return this.configDir;
  }
}