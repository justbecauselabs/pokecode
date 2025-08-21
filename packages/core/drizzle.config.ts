import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/database/schema-sqlite/*',
  out: './src/database/migrations',
  dbCredentials: {
    url: ':memory:', // We don't need actual DB for generation
  },
});