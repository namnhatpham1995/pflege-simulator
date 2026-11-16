import path from 'node:path';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { db as defaultDb, type Database } from './client';

export const MIGRATIONS_FOLDER = path.join(process.cwd(), 'drizzle');

/** Applies the tracked migrations. Never used by a request or a build step. */
export async function runMigrations(
  database: Database = defaultDb,
  migrationsFolder = MIGRATIONS_FOLDER,
): Promise<void> {
  await migrate(database, { migrationsFolder });
}
