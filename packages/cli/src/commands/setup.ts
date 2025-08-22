import { join } from 'node:path';
import { getConfig } from '@pokecode/core';

type SetupOptions = Record<string, never>;

interface Config {
  claudeCodePath?: string;
  [key: string]: unknown;
}

export async function setup(_options: SetupOptions): Promise<void> {
  console.log('PokéCode Setup');
  console.log('=============');
  console.log();
  console.log('To get started, I need the path to your Claude Code installation.');
  console.log('Please run `which claude` in your terminal and paste the output below:');
  console.log();

  // Read from stdin
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  let input = '';

  return new Promise((resolve, reject) => {
    const onData = (key: string) => {
      if (key === '\u0003') {
        // Ctrl+C
        process.exit();
      }

      if (key === '\r' || key === '\n') {
        // Enter key
        stdin.removeListener('data', onData);
        stdin.setRawMode(false);
        stdin.pause();

        processClaudePath(input.trim()).then(resolve).catch(reject);
        return;
      }

      if (key === '\u007f') {
        // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }

      // Regular character
      input += key;
      process.stdout.write(key);
    };

    stdin.on('data', onData);
    process.stdout.write('Claude path: ');
  });
}

async function processClaudePath(rawPath: string): Promise<void> {
  console.log();

  if (!rawPath) {
    console.error('Error: No path provided. Please run the setup command again.');
    process.exit(1);
  }

  // Remove any alias prefix and extract the actual path
  let claudePath = rawPath;

  // Handle "claude: aliased to /path/to/claude" format
  const aliasMatch = rawPath.match(/claude:\s*aliased to (.+)/);
  if (aliasMatch?.[1]) {
    claudePath = aliasMatch[1];
  }

  // Handle "/path/to/claude" format directly
  claudePath = claudePath.trim();

  console.log(`Validating Claude Code installation at: ${claudePath}`);

  // Check if the provided path exists
  const claudeFile = Bun.file(claudePath);
  if (!(await claudeFile.exists())) {
    console.error(`Error: Claude executable not found at ${claudePath}`);
    console.error('Please check the path and try again, or install Claude Code first.');
    process.exit(1);
  }

  // Construct the expected cli.js path
  const cliJsPath = claudePath.replace(
    /\/claude$/,
    '/node_modules/@anthropic-ai/claude-code/cli.js',
  );

  // Validate that cli.js exists
  const cliJsFile = Bun.file(cliJsPath);
  if (!(await cliJsFile.exists())) {
    console.error(`Error: Claude Code CLI not found at ${cliJsPath}`);
    console.error('Please check your Claude Code installation or provide a different path.');
    process.exit(1);
  }

  // Save to config
  await saveClaudeCodePath(cliJsPath);

  console.log('✅ Setup completed successfully!');
  console.log(`Claude Code CLI found at: ${cliJsPath}`);
  console.log();
  console.log('You can now use PokéCode commands.');
}

async function saveClaudeCodePath(cliJsPath: string): Promise<void> {
  const systemConfig = await getConfig();
  const configPath = join(systemConfig.configDir, 'config.json');

  // Ensure config directory exists
  await Bun.$`mkdir -p ${systemConfig.configDir}`;

  // Read existing config or create new one
  let config: Config = {};
  const configFile = Bun.file(configPath);

  if (await configFile.exists()) {
    try {
      const configContent = await configFile.text();
      config = JSON.parse(configContent);
    } catch (_error) {
      console.warn('Warning: Could not parse existing config file. Creating new one.');
    }
  }

  // Update config with Claude Code path
  config.claudeCodePath = cliJsPath;

  // Write config file
  await Bun.write(configPath, JSON.stringify(config, null, 2));
}
