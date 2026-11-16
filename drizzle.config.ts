import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
const localUrl = process.env.DATABASE_URL?.trim() || 'file:./.local/dev.db';

const credentials = tursoUrl
  ? { url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN?.trim() }
  : { url: localUrl };

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
  dbCredentials: credentials,
});
