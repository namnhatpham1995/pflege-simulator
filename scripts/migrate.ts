import { config as loadEnv } from 'dotenv';
import { db } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';

/**
 * drizzle-kit migrate exits 1 without a message against Turso, so the tracked
 * migrations are applied with the same migrator the app itself uses.
 */
async function main(): Promise<void> {
  loadEnv({ path: ['.env.local', '.env'], quiet: true });
  await runMigrations(db);
  console.log('Migrationen angewendet.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
