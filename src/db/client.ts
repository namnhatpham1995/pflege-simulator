import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

export const DEFAULT_LOCAL_DATABASE_URL = 'file:./.local/dev.db';

export type Database = LibSQLDatabase<typeof schema>;

export interface DatabaseHandle {
  client: Client;
  db: Database;
}

export function resolveDatabaseUrl(): string {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (tursoUrl) return tursoUrl;
  return process.env.DATABASE_URL?.trim() || DEFAULT_LOCAL_DATABASE_URL;
}

export function resolveAuthToken(url: string): string | undefined {
  const isRemote = url.startsWith('libsql://') || url.startsWith('https://') || url.startsWith('http://');
  if (!isRemote) return undefined;
  return process.env.TURSO_AUTH_TOKEN?.trim() || undefined;
}

function ensureLocalDirectory(url: string): void {
  if (!url.startsWith('file:')) return;
  const filePath = url.slice('file:'.length);
  if (!filePath || filePath === ':memory:') return;
  const absolute = path.resolve(process.cwd(), filePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
}

/**
 * Creates a fresh client. Tests and scripts use this to target an isolated file;
 * application code uses the memoised `db` export below.
 */
export function createDatabase(url = resolveDatabaseUrl(), authToken = resolveAuthToken(url)): DatabaseHandle {
  ensureLocalDirectory(url);
  const client = createClient(authToken ? { url, authToken } : { url });
  // libSQL does not enable foreign-key enforcement by default.
  void client.execute('PRAGMA foreign_keys = ON').catch(() => undefined);
  const db = drizzle(client, { schema });
  return { client, db };
}

type GlobalWithDatabase = typeof globalThis & {
  __pflegeDatabase?: DatabaseHandle;
};

const globalHolder = globalThis as GlobalWithDatabase;

function getHandle(): DatabaseHandle {
  if (process.env.NODE_ENV === 'production') {
    return createDatabase();
  }
  if (!globalHolder.__pflegeDatabase) {
    globalHolder.__pflegeDatabase = createDatabase();
  }
  return globalHolder.__pflegeDatabase;
}

const handle = getHandle();

export const db: Database = handle.db;
export const sqliteClient: Client = handle.client;

export async function closeDatabase(): Promise<void> {
  const current = globalHolder.__pflegeDatabase;
  delete globalHolder.__pflegeDatabase;
  if (current) current.client.close();
}

export { schema };
