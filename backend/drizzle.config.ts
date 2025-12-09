import { defineConfig } from 'drizzle-kit';
import { loadEnv, requireEnv } from './src/shared/config/env';

loadEnv('..');

export default defineConfig({
  schema: './src/infrastructure/database/drizzle/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: requireEnv('DATABASE_URL'),
  },
  verbose: true,
  strict: true,
});
