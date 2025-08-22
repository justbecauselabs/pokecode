/**
 * Config command implementation
 */

import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { platform } from 'node:os';
import chalk from 'chalk';
import { DaemonManager } from '../utils/daemon';

export interface ConfigOptions {
  init?: boolean;
  show?: boolean;
  edit?: boolean;
}

interface PokeCodeConfig {
  port?: number;
  host?: string;
  dataDir?: string;
  logLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  corsEnabled?: boolean;
  helmetEnabled?: boolean;
  claudeCodePath?: string;
  repositories?: string[];
  workerConcurrency?: number;
  workerPollingInterval?: number;
  maxFileSize?: number;
  jobRetention?: number;
  maxJobAttempts?: number;
}

const defaultConfig: PokeCodeConfig = {
  port: 3001,
  host: '0.0.0.0',
  logLevel: 'info',
  corsEnabled: true,
  helmetEnabled: true,
  workerConcurrency: 5,
  workerPollingInterval: 1000,
  maxFileSize: 10 * 1024 * 1024,
  jobRetention: 30,
  maxJobAttempts: 1,
  repositories: [],
};

export const config = async (options: ConfigOptions): Promise<void> => {
  const daemonManager = new DaemonManager();
  const configFile = await daemonManager.getConfigFile();

  if (options.init) {
    await initConfig(configFile);
  } else if (options.show) {
    await showConfig(configFile);
  } else if (options.edit) {
    await editConfig(configFile);
  } else {
    // Default: show current config
    await showConfig(configFile);
  }
};

const initConfig = async (_configFile: string): Promise<void> => {
  try {
    const daemonManager = new DaemonManager();
    await daemonManager.ensureConfigDir();

    // Set default data directory
    const configFile = await daemonManager.getConfigFile();
    const configWithDefaults = {
      ...defaultConfig,
      dataDir: `${configFile.replace('/config.json', '')}/data`,
    };

    await writeFile(configFile, JSON.stringify(configWithDefaults, null, 2), 'utf-8');

    console.log(chalk.green('✅ Configuration file initialized'));
    console.log(`📁 Config file: ${chalk.cyan(configFile)}`);
    console.log('\nDefault configuration:');
    console.log(JSON.stringify(configWithDefaults, null, 2));
    console.log(`\nEdit the configuration: ${chalk.cyan('pokecode config --edit')}`);
  } catch (error) {
    console.error(chalk.red('❌ Failed to initialize configuration:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
};

const showConfig = async (configFile: string): Promise<void> => {
  try {
    const config = await loadConfig(configFile);

    console.log(chalk.blue('📋 Current PokéCode configuration:\n'));
    console.log(`📁 Config file: ${chalk.cyan(configFile)}`);
    console.log('');

    if (Object.keys(config).length === 0) {
      console.log(chalk.yellow('No configuration file found.'));
      console.log(`To create one, run: ${chalk.cyan('pokecode config --init')}`);
      return;
    }

    // Display config in a nice format
    Object.entries(config).forEach(([key, value]) => {
      const formattedKey = key.padEnd(12);
      console.log(`${chalk.gray(formattedKey)}: ${chalk.white(JSON.stringify(value))}`);
    });

    console.log(`\nTo edit the configuration: ${chalk.cyan('pokecode config --edit')}`);
  } catch (error) {
    console.error(chalk.red('❌ Failed to show configuration:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
};

const editConfig = async (configFile: string): Promise<void> => {
  try {
    const daemonManager = new DaemonManager();
    await daemonManager.ensureConfigDir();

    // Ensure config file exists
    try {
      await readFile(configFile);
    } catch {
      // File doesn't exist, create it
      await initConfig(configFile);
    }

    // Determine editor
    const editor = process.env.EDITOR || process.env.VISUAL || getDefaultEditor();

    console.log(chalk.blue(`📝 Opening configuration file in ${editor}...`));
    console.log(`📁 File: ${chalk.cyan(configFile)}`);

    const child = spawn(editor, [configFile], {
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green('\n✅ Configuration file saved'));
        console.log(`View configuration: ${chalk.cyan('pokecode config --show')}`);
      } else {
        console.log(chalk.yellow('\n⚠️  Editor exited with non-zero code'));
      }
    });

    child.on('error', (error) => {
      console.error(chalk.red('❌ Failed to open editor:'));
      console.error(chalk.red(error.message));
      console.log(`\nManually edit the file: ${chalk.cyan(configFile)}`);
    });
  } catch (error) {
    console.error(chalk.red('❌ Failed to edit configuration:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
};

const loadConfig = async (configFile: string): Promise<PokeCodeConfig> => {
  try {
    const content = await readFile(configFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
};

const getDefaultEditor = (): string => {
  const isWindows = platform() === 'win32';

  if (isWindows) {
    return 'notepad';
  } else {
    // Try common editors in order of preference
    const editors = ['nano', 'vim', 'vi'];
    return editors[0] || 'nano'; // Default to nano for simplicity
  }
};
