import { createHash, randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import { HttpError } from '@/lib/api-error';
import { getEnv } from '@/lib/env';
import { SESSION_COOKIE_NAME, type Actor } from '@/lib/types';

export const SESSION_IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export interface CreatedSession {
  token: string;
  expiresAt: string;
}

/** Session tokens carry 256 bits of entropy, so a peppered SHA-256 is enough. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(`${getEnv().SESSION_SECRET}:${token}`).digest('hex');
}

export async function createSession(actor: Actor): Promise<CreatedSession> {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_TIMEOUT_MS).toISOString();

  await db.insert(sessions).values({
    idHash: hashSessionToken(token),
    actorType: actor.type,
    actorId: actor.id,
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt,
  });

  return { token, expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.idHash, hashSessionToken(token)));
}

export async function resolveActorFromToken(token: string): Promise<Actor | null> {
  const idHash = hashSessionToken(token);
  const rows = await db.select().from(sessions).where(eq(sessions.idHash, idHash)).limit(1);
  const row = rows[0];
  if (!row) return null;

  const now = Date.now();
  const expiresAt = Date.parse(row.expiresAt);
  const lastSeenAt = Date.parse(row.lastSeenAt);

  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    await db.delete(sessions).where(eq(sessions.idHash, idHash));
    return null;
  }
  if (Number.isFinite(lastSeenAt) && lastSeenAt + SESSION_IDLE_TIMEOUT_MS <= now) {
    await db.delete(sessions).where(eq(sessions.idHash, idHash));
    return null;
  }

  if (!Number.isFinite(lastSeenAt) || now - lastSeenAt > TOUCH_INTERVAL_MS) {
    await db
      .update(sessions)
      .set({ lastSeenAt: new Date(now).toISOString() })
      .where(and(eq(sessions.idHash, idHash)));
  }

  if (row.actorType === 'teacher') {
    return {
      type: 'teacher',
      id: row.actorId,
      displayName: getEnv().TEACHER_DISPLAY_NAME,
    };
  }

  // Group sessions are gone; an old row is simply not an actor any more.
  return null;
}

export function readCookieValue(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    if (key !== name) continue;
    const rawValue = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
  return undefined;
}

async function readTokenFromServerCookies(): Promise<string | undefined> {
  const { cookies } = await import('next/headers');
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value;
}

export async function readSessionToken(request?: Request): Promise<string | undefined> {
  if (request) {
    return readCookieValue(request.headers.get('cookie'), SESSION_COOKIE_NAME);
  }
  return readTokenFromServerCookies();
}

export async function requireActor(request?: Request): Promise<Actor> {
  const token = await readSessionToken(request);
  if (!token) throw HttpError.unauthenticated();
  const actor = await resolveActorFromToken(token);
  if (!actor) throw HttpError.unauthenticated();
  return actor;
}

export function sessionCookieOptions(): {
  httpOnly: true;
  sameSite: 'lax';
  path: string;
  secure: boolean;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(SESSION_ABSOLUTE_TIMEOUT_MS / 1000),
  };
}
