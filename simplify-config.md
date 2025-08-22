# Configuration Simplification Migration Plan

## Current State Analysis
The codebase currently has:
- Environment variables (via Zod schema in `env.schema.ts`)
- CLI config file (`~/.pokecode/config.json`)
- Hardcoded defaults spread across multiple files
- Rate limits, file storage, database, and service configs scattered

## New Unified Configuration System

### 1. **Single Config Structure**
Create/Update `packages/core/src/config/index.ts` with:
```typescript
interface Config {
  // Server
  port: number;
  host: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  
  // Database
  databasePath: string;
  databaseWAL: boolean;
  databaseCacheSize: number;
  
  // Paths
  claudeCodePath: string;
  dataDir: string;
  repositories: string[];
  
  // Rate Limiting
  rateLimits: {
    prompt: { max: number; windowMs: number };
    file: { max: number; windowMs: number };
    read: { max: number; windowMs: number };
  };
  
  // File Storage
  maxFileSize: number;
  allowedExtensions: string[];
  
  // Worker
  workerConcurrency: number;
  workerPollingInterval: number;
  
  // Security
  corsOrigins: string[];
  corsEnabled: boolean;
  helmetEnabled: boolean;
  
  // Queue
  jobRetention: number; // days
  maxJobAttempts: number;
}
```

### 2. **Priority System (Highest to Lowest)**
1. CLI override flags (runtime)
2. `~/.pokecode/config.json` file
3. Built-in defaults

### 3. **Config Implementation in `config/index.ts`**
- Load config.json on initialization
- Merge with defaults
- Apply CLI overrides when passed
- Provide singleton access via `getConfig()` and `config` export
- NO environment variable checks

## Migration Steps

### Phase 1: Core Infrastructure
1. Update `packages/core/src/config/index.ts` with new `Config` interface and defaults
2. Implement config loading with priority system in same file
3. Add config validation using Zod (but for config.json, not env vars)
4. Create config migration utility for existing config.json files

### Phase 2: Remove Environment Variables
1. Remove `env.schema.ts`
2. Update all `process.env` references to use the config
3. Remove environment variable checks from:
   - `packages/core/src/config/index.ts`
   - `packages/core/src/utils/env.ts`
   - Database initialization
   - Logger configuration

### Phase 3: Consolidate Configurations
1. Move all scattered configs into the single `Config` interface:
   - Rate limit configs (currently in `config/index.ts`)
   - File storage config (currently in `config/index.ts`)
   - Worker settings (hardcoded in worker file)
   - Database settings (hardcoded in database/index.ts)
2. Update all services to import and use `config` from `@pokecode/core`

### Phase 4: CLI Integration
1. Update `pokecode serve` command to pass overrides to config
2. Update `pokecode config` commands to work with new structure
3. Add config validation on startup
4. Add config migration for users with old format

### Phase 5: Clean Up
1. Remove old config loading functions
2. Remove duplicate default values
3. Update tests to use new config
4. Update documentation

## Benefits
- Single source of truth for all configuration
- Clear priority system (CLI > file > defaults)
- No environment variable confusion
- Easier to test and maintain
- Type-safe configuration access
- Simplified deployment (just one config.json file)

## Files to Modify

### **Update**: 
- `packages/core/src/config/index.ts` - Main config file with all logic
- `packages/core/src/database/index.ts` - Use config instead of hardcoded values
- `packages/server/src/index.ts` - Use config for server settings
- `packages/server/src/workers/claude-code-sqlite.worker.ts` - Use config for worker settings
- `packages/cli/src/commands/serve.ts` - Pass CLI overrides to config
- `packages/cli/src/commands/config.ts` - Update to new config structure
- `packages/core/src/utils/logger.ts` - Use config instead of env vars
- `packages/server/src/plugins/cors.ts` - Use config for CORS settings

### **Remove**: 
- `packages/core/src/config/env.schema.ts`
- All `process.env` references throughout codebase

## Backwards Compatibility
- Provide migration utility for existing config.json files
- Log warnings for deprecated config keys
- Keep API contracts the same for services

## Example Config Loading in `config/index.ts`
```typescript
const defaultConfig: Config = { 
  port: 3001,
  host: '0.0.0.0',
  logLevel: 'info',
  databasePath: '~/.pokecode/data/pokecode.db',
  databaseWAL: true,
  databaseCacheSize: 1000000,
  claudeCodePath: '',
  dataDir: '~/.pokecode/data',
  repositories: [],
  rateLimits: {
    prompt: { max: 10, windowMs: 60000 },
    file: { max: 100, windowMs: 60000 },
    read: { max: 1000, windowMs: 60000 }
  },
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedExtensions: ['.js', '.ts', '.jsx', '.tsx', '.json', '.md', /* etc */],
  workerConcurrency: 5,
  workerPollingInterval: 1000,
  corsOrigins: ['*'],
  corsEnabled: true,
  helmetEnabled: true,
  jobRetention: 30, // days
  maxJobAttempts: 1
};

let _config: Config;
let _cliOverrides: Partial<Config> = {};

export function setCliOverrides(overrides: Partial<Config>) {
  _cliOverrides = overrides;
  _config = mergeConfigs();
}

function loadConfig(): Config {
  const configFile = loadConfigFile(); // from ~/.pokecode/config.json
  return mergeConfigs(defaultConfig, configFile, _cliOverrides);
}

function mergeConfigs(...configs: Partial<Config>[]): Config {
  // Deep merge logic here
}

function loadConfigFile(): Partial<Config> {
  // Load and parse ~/.pokecode/config.json
}

export const config = loadConfig();
export function getConfig() { 
  return _config || config; 
}
```

## Configuration Values to Centralize

### Current Scattered Values:
- **Rate Limits**: `config/index.ts` - prompt(10/1min), file(100/1min), read(1000/1min)
- **File Storage**: `config/index.ts` - maxFileSize(10MB), allowedExtensions(26+ types)
- **Database**: `database/index.ts` - WAL mode, cache_size(1GB), pragmas
- **Worker**: `workers/claude-code-sqlite.worker.ts` - concurrency(5), polling(1s)
- **Server**: `server/index.ts` - SSE retryDelay(3s), highWaterMark(16KB)
- **CORS**: `plugins/cors.ts` - maxAge(24h), credentials, methods
- **Logger**: `utils/logger.ts` - level, streams, file output

### Environment Variables to Remove:
- `NODE_ENV` 
- `PORT`
- `LOG_LEVEL`
- `BUN_TEST`
- `SQLITE_DB_PATH`
- `CLAUDE_CODE_PATH`
- `RATE_LIMIT_WINDOW`
- `RATE_LIMIT_MAX`
- `CORS_ORIGIN`
- `npm_package_version`

## Migration Checklist

- [ ] Create new `Config` interface in `config/index.ts`
- [ ] Implement config loading with priority system
- [ ] Remove `env.schema.ts` and environment variable validation
- [ ] Update database initialization to use config
- [ ] Update server initialization to use config
- [ ] Update worker settings to use config
- [ ] Update logger configuration to use config
- [ ] Update CORS plugin to use config
- [ ] Update CLI commands to support new config structure
- [ ] Create config migration utility
- [ ] Remove all `process.env` references
- [ ] Update tests
- [ ] Update documentation