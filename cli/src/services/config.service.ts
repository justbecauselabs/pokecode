/**
 * Configuration service for managing local CLI settings
 * Handles reading/writing config file with proper permissions
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { Config, RecentSession } from '../types';

export class ConfigService {
  private static instance: ConfigService;
  private configPath: string;
  private configDir: string;
  private config: Config;

  private constructor() {
    this.configDir = join(homedir(), '.pokecode-cli');
    this.configPath = join(this.configDir, 'config.json');
    this.config = this.loadConfig();
  }

  /**
   * Get singleton instance of ConfigService
   */
  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Load configuration from disk or create default
   */
  private loadConfig(): Config {
    try {
      if (!existsSync(this.configDir)) {
        mkdirSync(this.configDir, { recursive: true, mode: 0o700 });
      }

      if (!existsSync(this.configPath)) {
        const defaultConfig: Config = {
          serverUrl: process.env.POKECODE_API_URL || 'http://localhost:3001',
          recentSessions: [],
          debug: false,
          verbose: false
        };
        this.saveConfig(defaultConfig);
        return defaultConfig;
      }

      const content = readFileSync(this.configPath, 'utf-8');
      return JSON.parse(content) as Config;
    } catch (error) {
      console.error('Failed to load config:', error);
      return {
        serverUrl: 'http://localhost:3001',
        recentSessions: [],
        debug: false,
        verbose: false
      };
    }
  }

  /**
   * Save configuration to disk with secure permissions
   */
  private saveConfig(config: Config): void {
    try {
      if (!existsSync(this.configDir)) {
        mkdirSync(this.configDir, { recursive: true, mode: 0o700 });
      }

      writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
      // Set file permissions to 600 (read/write for owner only)
      chmodSync(this.configPath, 0o600);
      this.config = config;
    } catch (error) {
      throw new Error(`Failed to save config: ${error}`);
    }
  }

  /**
   * Get the current configuration
   */
  public getConfig(): Config {
    return { ...this.config };
  }

  /**
   * Get server URL
   */
  public getServerUrl(): string {
    return this.config.serverUrl;
  }

  /**
   * Set server URL
   */
  public setServerUrl(url: string): void {
    this.config.serverUrl = url;
    this.saveConfig(this.config);
  }

  /**
   * Get authentication tokens
   */
  public getAuth(): Config['auth'] {
    return this.config.auth;
  }

  /**
   * Set authentication tokens and user info
   */
  public setAuth(auth: Config['auth']): void {
    this.config.auth = auth;
    this.saveConfig(this.config);
  }

  /**
   * Clear authentication data
   */
  public clearAuth(): void {
    delete this.config.auth;
    this.saveConfig(this.config);
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(): boolean {
    return !!this.config.auth?.accessToken;
  }

  /**
   * Get recent sessions
   */
  public getRecentSessions(): RecentSession[] {
    return this.config.recentSessions || [];
  }

  /**
   * Add or update a recent session
   */
  public addRecentSession(session: RecentSession): void {
    const sessions = this.config.recentSessions || [];
    
    // Remove existing session with same ID if present
    const filtered = sessions.filter(s => s.id !== session.id);
    
    // Add new session at the beginning
    filtered.unshift(session);
    
    // Keep only last 5 sessions
    this.config.recentSessions = filtered.slice(0, 5);
    this.saveConfig(this.config);
  }

  /**
   * Set debug mode
   */
  public setDebugMode(enabled: boolean): void {
    this.config.debug = enabled;
    this.saveConfig(this.config);
  }

  /**
   * Get debug mode status
   */
  public isDebugMode(): boolean {
    return this.config.debug || false;
  }

  /**
   * Set verbose mode
   */
  public setVerboseMode(enabled: boolean): void {
    this.config.verbose = enabled;
    this.saveConfig(this.config);
  }

  /**
   * Get verbose mode status
   */
  public isVerboseMode(): boolean {
    return this.config.verbose || false;
  }
}