import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createDatabase, type Database, type DatabaseHandle } from '@/db/client';
import { runMigrations } from '@/db/migrate';

export interface TestDatabase extends DatabaseHandle {
  url: string;
  dispose: () => Promise<void>;
}

/** One fresh migrated libSQL file per test file; no mock database anywhere. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const directory = mkdtempSync(path.join(tmpdir(), 'pflege-test-'));
  const filePath = path.join(directory, 'test.db').replace(/\\/g, '/');
  const url = `file:${filePath}`;
  const handle = createDatabase(url);
  await runMigrations(handle.db);
  return {
    ...handle,
    url,
    dispose: async () => {
      try {
        handle.client.close();
      } catch {
        // The native handle may already be gone; nothing to clean up then.
      }
      try {
        // Windows keeps the libSQL file locked for a moment after close.
        rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      } catch {
        // A leftover temp directory must never fail an otherwise green suite.
      }
    },
  };
}

let appDatabasePromise: Promise<Database> | null = null;

/**
 * The application singleton for tests. tests/setup.ts points DATABASE_URL at a
 * per-file file before any application module is loaded, so this is still
 * isolated between test files.
 */
export function appDatabase(): Promise<Database> {
  if (!appDatabasePromise) {
    appDatabasePromise = (async () => {
      const { db } = await import('@/db/client');
      await runMigrations(db);
      return db;
    })();
  }
  return appDatabasePromise;
}
