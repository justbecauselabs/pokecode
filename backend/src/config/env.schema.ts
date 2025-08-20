import { z } from 'zod';

export const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().pipe(z.coerce.number()).default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Test Environment Detection
  BUN_TEST: z.string().optional(),

  // SQLite Database Configuration
  SQLITE_DB_PATH: z.string().optional(), // Defaults to './data/pokecode.db'

  // Claude Code CLI Path - REQUIRED for worker functionality
  CLAUDE_CODE_PATH: z.string().min(1),

  // GitHub Repositories Directory (required)
  GITHUB_REPOS_DIRECTORY: z.string().min(1),

  // Rate Limiting
  RATE_LIMIT_WINDOW: z.string().pipe(z.coerce.number()).default(60000),
  RATE_LIMIT_MAX: z.string().pipe(z.coerce.number()).default(100),

  // CORS
  CORS_ORIGIN: z.string().default('*'),

  // Package version (set by runtime)
  npm_package_version: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

// Validate and parse environment variables
export function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // Use console for early initialization errors
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    process.exit(1);
  }

  return parsed.data;
}
