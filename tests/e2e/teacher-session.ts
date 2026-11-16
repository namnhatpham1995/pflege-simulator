import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@libsql/client';
import { config as loadEnv } from 'dotenv';

const E2E_DATABASE_URL = 'file:./.local/e2e.db';

/**
 * The e2e server uses the machine's own teacher password, so the browser check
 * mints a session directly in the throwaway e2e database instead of knowing it.
 * The login route itself is covered by the integration tests.
 */
export async function createTeacherSession(): Promise<string> {
  loadEnv({ path: ['.env.local', '.env'], quiet: true });
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET fehlt für die E2E-Sitzung.');

  const token = randomBytes(32).toString('base64url');
  const idHash = createHash('sha256').update(`${secret}:${token}`).digest('hex');
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const client = createClient({ url: E2E_DATABASE_URL });
  try {
    await client.execute({
      sql: `insert into sessions (id_hash, actor_type, actor_id, created_at, last_seen_at, expires_at)
            values (?, 'teacher', 'teacher', ?, ?, ?)`,
      args: [idHash, now, now, expiresAt],
    });
  } finally {
    client.close();
  }

  return token;
}
