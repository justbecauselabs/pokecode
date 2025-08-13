import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema-sqlite/*',
  out: './drizzle',
  dbCredentials: {
    url: './data/pokecode.db',
  },
});
