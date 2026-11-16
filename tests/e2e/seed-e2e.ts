import { config as loadEnv } from 'dotenv';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Playwright's webServer runs this before `next dev`, so every browser run gets
 * a deterministic, freshly seeded database and codes that are not the term's.
 */
const DATABASE_FILE = '.local/e2e.db';
const CODES_FILE = '.local/e2e-codes.json';

async function main(): Promise<void> {
  loadEnv({ path: ['.env.local', '.env'], quiet: true });
  process.env.DATABASE_URL = `file:${DATABASE_FILE}`;

  mkdirSync('.local', { recursive: true });
  for (const suffix of ['', '-wal', '-shm']) {
    rmSync(path.join(process.cwd(), `${DATABASE_FILE}${suffix}`), { force: true });
  }

  const { runMigrations } = await import('../../src/db/migrate');
  await runMigrations();

  const { db, closeDatabase } = await import('../../src/db/client');
  const { seedDatabase } = await import('../../src/db/seed');
  const result = await seedDatabase(db, { writeCodeFile: false });

  writeFileSync(
    CODES_FILE,
    JSON.stringify(
      result.codes.map(({ groupName, groupId, code }) => ({ groupName, groupId, code })),
      null,
      2,
    ),
    { mode: 0o600 },
  );

  await closeDatabase();
  console.log(`E2E-Datenbank bereit: ${result.patients} Patienten, ${result.codes.length} Codes.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
