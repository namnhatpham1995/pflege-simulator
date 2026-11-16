import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { loginAttempts } from '@/db/schema';
import { HttpError } from '@/lib/api-error';

/**
 * Fixed windows because the runtime is stateless: each window is a row keyed by
 * (key, window_start), incremented with an atomic upsert.
 */
export const CODE_WINDOW_MS = 5 * 60 * 1000;
export const IP_WINDOW_MS = 10 * 60 * 1000;
export const CODE_LIMIT = 5;
export const IP_LIMIT = 60;

export interface AttemptKeys {
  codeKey: string;
  ipKey: string;
}

export interface AttemptCounts {
  code: number;
  ip: number;
  retryAfterCodeSeconds: number;
  retryAfterIpSeconds: number;
}

function windowStart(now: Date, sizeMs: number): string {
  return new Date(Math.floor(now.getTime() / sizeMs) * sizeMs).toISOString();
}

function windowEndMs(startIso: string, sizeMs: number): number {
  return Date.parse(startIso) + sizeMs;
}

async function readCount(key: string, start: string): Promise<number> {
  const rows = await db
    .select({ count: loginAttempts.count })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, key), eq(loginAttempts.windowStart, start)))
    .limit(1);
  return rows[0]?.count ?? 0;
}

async function increment(key: string, start: string): Promise<number> {
  const rows = await db
    .insert(loginAttempts)
    .values({ key, windowStart: start, count: 1 })
    .onConflictDoUpdate({
      target: [loginAttempts.key, loginAttempts.windowStart],
      set: { count: sql`${loginAttempts.count} + 1` },
    })
    .returning({ count: loginAttempts.count });
  return rows[0]?.count ?? 1;
}

export async function readAttempts(keys: AttemptKeys, now: Date = new Date()): Promise<AttemptCounts> {
  const codeStart = windowStart(now, CODE_WINDOW_MS);
  const ipStart = windowStart(now, IP_WINDOW_MS);
  const [code, ip] = await Promise.all([readCount(keys.codeKey, codeStart), readCount(keys.ipKey, ipStart)]);
  return {
    code,
    ip,
    retryAfterCodeSeconds: Math.max(1, Math.ceil((windowEndMs(codeStart, CODE_WINDOW_MS) - now.getTime()) / 1000)),
    retryAfterIpSeconds: Math.max(1, Math.ceil((windowEndMs(ipStart, IP_WINDOW_MS) - now.getTime()) / 1000)),
  };
}

/** Refuses an attempt whose window is already exhausted, before any hash work. */
export async function assertLoginAllowed(keys: AttemptKeys, now: Date = new Date()): Promise<void> {
  const counts = await readAttempts(keys, now);
  if (counts.code >= CODE_LIMIT) {
    throw new HttpError(429, 'RATE_LIMITED', undefined, { retryAfterSeconds: counts.retryAfterCodeSeconds });
  }
  if (counts.ip >= IP_LIMIT) {
    throw new HttpError(429, 'RATE_LIMITED', undefined, { retryAfterSeconds: counts.retryAfterIpSeconds });
  }
}

/**
 * Records a failed attempt and prunes stale windows. The fifth failed attempt in
 * a window is the one that reports 429 to the client.
 */
export async function registerFailedAttempt(keys: AttemptKeys, now: Date = new Date()): Promise<void> {
  const codeStart = windowStart(now, CODE_WINDOW_MS);
  const ipStart = windowStart(now, IP_WINDOW_MS);

  const [codeCount, ipCount] = await Promise.all([
    increment(keys.codeKey, codeStart),
    increment(keys.ipKey, ipStart),
  ]);

  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  void db.delete(loginAttempts).where(lt(loginAttempts.windowStart, cutoff)).catch(() => undefined);

  if (codeCount >= CODE_LIMIT) {
    throw new HttpError(429, 'RATE_LIMITED', undefined, {
      retryAfterSeconds: Math.max(1, Math.ceil((windowEndMs(codeStart, CODE_WINDOW_MS) - now.getTime()) / 1000)),
    });
  }
  if (ipCount >= IP_LIMIT) {
    throw new HttpError(429, 'RATE_LIMITED', undefined, {
      retryAfterSeconds: Math.max(1, Math.ceil((windowEndMs(ipStart, IP_WINDOW_MS) - now.getTime()) / 1000)),
    });
  }
}

/** A successful login removes every window for that code key. */
export async function clearCodeAttempts(codeKey: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.key, codeKey));
}
