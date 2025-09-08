import { CONFIG_DIR, CONFIG_FILE, type FileConfig } from '@pokecode/core';

type SetupOptions = Record<string, never>;

export async function setup(_options: SetupOptions): Promise<void> {
  const configExists = await Bun.file(CONFIG_FILE).exists();
  if (configExists) {
    console.log('An existing PokéCode config was found.');
    const shouldUpdate = await confirmYesNo('Do you want to update paths now? (y/N) ');
    if (!shouldUpdate) {
      console.log('Exiting without changes.');
      process.exit(0);
    }
  }

  console.log('==================');
  console.log('  PokéCode Setup  ');
  console.log('==================');
  console.log();
  console.log('To get started, I need the path to your Claude Code installation.');
  console.log('Please run `which claude` in your terminal and paste the output below:');
  console.log();

  const claudePath = await promptLine('Claude path: ');
  await processClaudePath(claudePath.trim());

  console.log();
  console.log('Optionally, provide the path to your Codex CLI.');
  console.log('Tip: run `which codex`. Press Enter to skip.');
  const codexPathRaw = await promptLine('Codex path (optional): ');
  const codexPath = codexPathRaw.trim();
  if (codexPath.length > 0) {
    await processCodexPath(codexPath);
  } else {
    await savePaths({ codexCliPath: undefined });
  }
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
  await savePaths({ claudeCodePath: cliJsPath });

  console.log('✅ Setup completed successfully!');
  console.log(`Claude Code CLI found at: ${cliJsPath}`);
  console.log();
  console.log('You can now use PokéCode commands.');
}

async function processCodexPath(rawPath: string): Promise<void> {
  console.log();
  let codexPath = rawPath.trim();
  const aliasMatch = rawPath.match(/codex:\s*aliased to (.+)/);
  if (aliasMatch?.[1]) codexPath = aliasMatch[1];

  console.log(`Validating Codex CLI at: ${codexPath}`);
  const file = Bun.file(codexPath);
  if (!(await file.exists())) {
    console.error(`Error: Codex CLI not found at ${codexPath}`);
    process.exit(1);
  }
  try {
    const proc = Bun.spawn({ cmd: [codexPath, '--version'], stdout: 'pipe', stderr: 'pipe' });
    await proc.exited;
  } catch {
    // Non-fatal
  }
  await savePaths({ codexCliPath: codexPath });
  console.log('✅ Codex CLI configured!');
  console.log(`Codex path: ${codexPath}`);
}

async function savePaths(pathsToSave: {
  claudeCodePath?: string;
  codexCliPath?: string | undefined;
}): Promise<void> {
  // Ensure config directory exists
  await Bun.$`mkdir -p ${CONFIG_DIR}`;

  // Read existing config or create new one
  let config: FileConfig = { repositories: [], claudeCodePath: '' };
  const existing = Bun.file(CONFIG_FILE);
  if (await existing.exists()) {
    try {
      const txt = await existing.text();
      const parsed = JSON.parse(txt) as Partial<FileConfig>;
      config = {
        repositories: Array.isArray(parsed.repositories) ? parsed.repositories : [],
        claudeCodePath: typeof parsed.claudeCodePath === 'string' ? parsed.claudeCodePath : '',
        codexCliPath: typeof parsed.codexCliPath === 'string' ? parsed.codexCliPath : undefined,
      } as FileConfig;
    } catch {
      // ignore, start fresh
    }
  }

  if (pathsToSave.claudeCodePath) config.claudeCodePath = pathsToSave.claudeCodePath;
  if (pathsToSave.codexCliPath !== undefined) config.codexCliPath = pathsToSave.codexCliPath;

  // Write config file
  await Bun.write(CONFIG_FILE, JSON.stringify(config, null, 2));
}

async function promptLine(label: string): Promise<string> {
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  let input = '';
  return new Promise((resolve) => {
    const onData = (key: string) => {
      if (key === '\u0003') process.exit();
      if (key === '\r' || key === '\n') {
        stdin.removeListener('data', onData);
        stdin.setRawMode(false);
        stdin.pause();
        process.stdout.write('\n');
        resolve(input);
        return;
      }
      if (key === '\u007f') {
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }
      input += key;
      process.stdout.write(key);
    };
    stdin.on('data', onData);
    process.stdout.write(label);
  });
}

async function confirmYesNo(label: string): Promise<boolean> {
  const ans = (await promptLine(label)).trim().toLowerCase();
  return ans === 'y' || ans === 'yes';
}
