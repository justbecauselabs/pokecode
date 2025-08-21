# Migration: Single Binary CLI with Bun --compile

This guide outlines the focused changes to move PokéCode CLI to a single self‑contained binary using `bun --compile`, covering only:
- Server unification (single server module)
- Self‑daemonization via internal flag
- Compile build changes (no CI/tests in this doc)

The end state is one executable named `pokecode` that provides the CLI and runs the server as a daemonized background process without requiring Bun to be installed by end users.

---

## 1) Server Unification

Goal: Consolidate server startup logic into a single reusable module and remove ad‑hoc entry files.

### Target Design
- New module: `packages/cli/src/server.ts`
  - `export interface ServerConfig { port: number; host: string; dataDir: string; logLevel: string; cors: boolean; helmet: boolean; NODE_ENV?: string }`
  - `export function makeConfigFromEnv(): ServerConfig` — builds config from env + sensible defaults.
  - `export async function startServer(config: ServerConfig): Promise<void>` — initializes DB, creates Fastify app via `@pokecode/server`, installs signal handlers, and starts listening.
- Replace usages of the old `src/server-entry.ts` with this module.
- Embedded mode in `serve` command calls `startServer(config)` directly.

### Migration Steps
1. Create `packages/cli/src/server.ts` and move logic from `packages/cli/src/server-entry.ts`:
   - Config loading (env and optional file lookups) → `makeConfigFromEnv()`
   - Database initialization and migrations → inside `startServer()` before calling `createServer(config)`
   - Signal handling (`SIGTERM`, `SIGINT`, `SIGUSR2`) and uncaught error handlers → inside `startServer()`
   - Start server: `await server.listen({ port: config.port, host: config.host })`
2. Update `packages/cli/src/commands/serve.ts`:
   - For embedded mode (no `--daemon`), call `startServer(config)` from the new module.
3. Remove references to `src/server-entry.ts` and then delete the file once all references are gone.

### Minimal Skeleton (TypeScript)
```ts
// packages/cli/src/server.ts
import { join } from 'node:path';
import { createServer } from '@pokecode/server';
import { DatabaseManager } from '@pokecode/core';

export interface ServerConfig {
  port: number;
  host: string;
  dataDir: string;
  logLevel: string;
  cors: boolean;
  helmet: boolean;
  NODE_ENV?: string;
}

export function makeConfigFromEnv(): ServerConfig {
  const home = process.env.HOME || process.env.USERPROFILE || '/tmp';
  const defaultData = join(home, '.pokecode', 'data');
  return {
    port: Number(process.env.POKECODE_PORT) || 3001,
    host: process.env.POKECODE_HOST || '0.0.0.0',
    dataDir: process.env.POKECODE_DATA_DIR || defaultData,
    logLevel: process.env.POKECODE_LOG_LEVEL || 'info',
    cors: process.env.POKECODE_CORS !== 'false',
    helmet: process.env.POKECODE_HELMET !== 'false',
    NODE_ENV: process.env.NODE_ENV || 'production',
  };
}

export async function startServer(config: ServerConfig): Promise<void> {
  // Ensure DB & tables exist
  const dbPath = join(config.dataDir, 'pokecode.db');
  const dbManager = new DatabaseManager({ dbPath, isTest: config.NODE_ENV === 'test', enableWAL: true });
  await dbManager.ensureTablesExist();

  const server = await createServer(config);

  const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'] as const;
  signals.forEach((signal) => {
    process.on(signal, async () => {
      try {
        await server.close();
        process.exit(0);
      } catch {
        process.exit(1);
      }
    });
  });

  process.on('uncaughtException', () => process.exit(1));
  process.on('unhandledRejection', () => process.exit(1));

  await server.listen({ port: config.port, host: config.host });
}
```

---

## 2) Self‑Daemonization Flag

Goal: The single binary should re‑exec itself to run the server in the background, with logs redirected to a file and with PID/metadata recorded.

### Internal Run Flag
- Hidden flag: `--internal-run-server`
  - When present, the binary starts the server directly via `startServer(makeConfigFromEnv())` and never registers the CLI commands.

### CLI Entry Changes
1. In `packages/cli/src/cli.ts` (top of file, before commander setup):
   ```ts
   import { startServer, makeConfigFromEnv } from './server.js';

   if (process.argv.includes('--internal-run-server')) {
     // Run as daemon child process (no CLI)
     await startServer(makeConfigFromEnv());
     process.exit(0);
   }
   ```
2. Register commander commands as usual after this early check.

### Serve Command Changes
- In `packages/cli/src/commands/serve.ts`, replace daemon spawning to re‑exec the same binary:

```ts
import { DaemonManager } from '../utils/daemon.js';

// ... inside startDaemon(config)
const daemonManager = new DaemonManager();
await daemonManager.ensureConfigDir();
const logFile = daemonManager.getLogFile();

const env: Record<string, string> = {
  POKECODE_PORT: String(config.port),
  POKECODE_HOST: config.host,
  POKECODE_DATA_DIR: config.dataDir,
  POKECODE_LOG_LEVEL: config.logLevel,
  POKECODE_CORS: String(config.cors),
  POKECODE_HELMET: String(config.helmet),
  NODE_ENV: process.env.NODE_ENV || 'production',
};

// Re-exec the same compiled binary
const self = process.execPath; // path to current executable
const child = Bun.spawn([self, '--internal-run-server'], {
  env: { ...process.env, ...env },
  stdout: Bun.file(logFile),
  stderr: Bun.file(logFile),
  stdin: 'ignore',
});

if (!child.pid) throw new Error('Failed to start daemon process');

await daemonManager.saveDaemonInfo({
  pid: child.pid,
  port: config.port,
  host: config.host,
  startTime: new Date().toISOString(),
  dataDir: config.dataDir,
  logFile,
});

// Parent exits immediately to detach
process.exit(0);
```

Notes:
- `process.execPath` points to the compiled binary; this avoids locating any script file.
- Remove any `findServerEntry()` logic — not needed in the single‑binary model.
- Keep `DaemonManager` as is (PID file, daemon.json, log path handling).

---

## 3) Compile Build Changes

Goal: Produce a single executable with Bun embedded.

### package.json (CLI)
Update `packages/cli/package.json`:

- Scripts:
  ```json
  {
    "scripts": {
      "build": "bun build src/cli.ts --compile --outfile dist/pokecode",
      "dev": "bun --watch src/cli.ts",
      "typecheck": "tsc --noEmit"
    }
  }
  ```

- Bin mapping:
  ```json
  {
    "bin": {
      "pokecode": "./dist/pokecode"
    },
    "main": "./dist/pokecode"
  }
  ```

- Remove unused scripts/files:
  - Delete `scripts/bundle-dependencies.js`
  - Delete `package.production.json` and any `prepare:publish` flows
  - Remove `build:bundle` and `build:types` if you no longer ship `.d.ts` (optional)

### Build Command
- Local build:
  ```bash
  cd packages/cli
  bun install
  bun run build
  ls -la dist/pokecode  # single binary
  ```

### Runtime Notes
- `bun --compile` bundles your code and Bun runtime into one binary — users do not need Bun installed.
- Avoid patterns that prevent static bundling (e.g., `dynamic import()` of non‑literal paths).
- Keep absolute imports internal to the CLI package or ensure the bundler can resolve workspace imports.

---

## 4) Cleanup Checklist

- [ ] New `packages/cli/src/server.ts` created; server logic migrated
- [ ] `packages/cli/src/server-entry.ts` removed
- [ ] `serve.ts` uses `startServer(...)` for embedded mode
- [ ] `cli.ts` handles `--internal-run-server` at process start
- [ ] Daemon spawn uses `process.execPath` and redirects logs
- [ ] Removed `findServerEntry()` and any runtime detection/path resolution for server
- [ ] Updated `packages/cli/package.json` scripts and `bin`
- [ ] Deleted `scripts/bundle-dependencies.js` and `package.production.json`

---

## 5) Quick Local Validation (manual)

1) Embedded run
```bash
cd packages/cli
bun run build
./dist/pokecode serve --port 3001 --host 127.0.0.1
# Hit http://127.0.0.1:3001/health in another terminal
```

2) Daemon mode
```bash
./dist/pokecode serve --daemon --port 3001 --host 127.0.0.1
./dist/pokecode status
./dist/pokecode logs -n 50
./dist/pokecode stop
```

3) Global test (optional, local)
```bash
npm pack  # create a tarball, or package via your chosen distribution strategy
npm i -g pokecode-*.tgz
pokecode --help
pokecode serve --daemon
```

---

## 6) Notes
- This document intentionally excludes CI/release packaging and tests.
- If you later distribute per‑platform binaries via npm or GitHub Releases, wire your chosen strategy on top of the compiled artifact produced here.
- Keep database/log/config locations unchanged to preserve compatibility for existing users.

