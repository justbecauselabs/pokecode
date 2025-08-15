import { defineConfig } from 'drizzle-kit';
import { isTest } from '@/utils/env';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema-sqlite/*',
  out: './drizzle',
  dbCredentials: {
    url: isTest() ? './tests/data/pokecode.db' : './data/pokecode.db',
  },
});
