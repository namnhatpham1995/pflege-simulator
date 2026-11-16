import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { POST as logoutRoute } from '@/app/api/auth/logout/route';
import { GET as patientsRoute } from '@/app/api/patients/route';
import { loginAttempts, patients, sessions } from '@/db/schema';
import { createSession, hashSessionToken } from '@/server/auth/session';
import type { Actor } from '@/lib/types';
import { appDatabase } from '../helpers/database';
import type { Database } from '@/db/client';

let db: Database;
let teacherToken = '';

const ORIGIN = 'http://localhost:3000';

function jsonRequest(path: string, body: unknown, options: { origin?: string | null; cookie?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.origin !== null) headers.origin = options.origin ?? ORIGIN;
  if (options.cookie) headers.cookie = options.cookie;
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  db = await appDatabase();
  await db.insert(patients).values([
    { id: 'p-1', displayName: 'Frau Albrecht', createdAt: new Date().toISOString() },
    { id: 'p-2', displayName: 'Herr Brandt', dateOfBirth: '1950-01-02', createdAt: new Date().toISOString() },
  ]);
  const teacher: Actor = { type: 'teacher', id: 'teacher', displayName: 'Test-Lehrkraft' };
  teacherToken = (await createSession(teacher)).token;
});

beforeEach(async () => {
  await db.delete(loginAttempts);
});

afterAll(async () => {
  const { closeDatabase } = await import('@/db/client');
  await closeDatabase();
});

describe('POST /api/auth/login', () => {
  it('rejects a foreign origin before touching credentials', async () => {
    const response = await loginRoute(
      jsonRequest('/api/auth/login', { password: 'lehrer-test-passwort' }, { origin: 'https://evil.example' }),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('ORIGIN');
  });

  it('rejects a missing origin and an invalid body', async () => {
    const missing = await loginRoute(
      jsonRequest('/api/auth/login', { password: 'lehrer-test-passwort' }, { origin: null }),
    );
    expect(missing.status).toBe(403);

    const invalid = await loginRoute(jsonRequest('/api/auth/login', { mode: 'group', code: 'ABCD' }));
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.code).toBe('VALIDATION');
  });

  it('returns 401 for a wrong password', async () => {
    const response = await loginRoute(jsonRequest('/api/auth/login', { password: 'falsch' }));
    expect(response.status).toBe(401);
    expect((await response.json()).error.message).toBe('Das Passwort ist falsch.');
  });

  it('signs the teacher in and sets an HttpOnly session cookie', async () => {
    const response = await loginRoute(
      jsonRequest('/api/auth/login', { password: 'lehrer-test-passwort' }),
    );
    expect(response.status).toBe(200);
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('pflege_session=');
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
    const body = await response.json();
    expect(body.actor).toMatchObject({ type: 'teacher' });
  });

  it('rotates an existing session cookie', async () => {
    const first = await loginRoute(jsonRequest('/api/auth/login', { password: 'lehrer-test-passwort' }));
    const firstCookie = (first.headers.get('set-cookie') ?? '').split(';')[0]!;
    const second = await loginRoute(
      jsonRequest('/api/auth/login', { password: 'lehrer-test-passwort' }, { cookie: firstCookie }),
    );
    expect(second.status).toBe(200);
    const rotated = (second.headers.get('set-cookie') ?? '').split(';')[0]!;
    expect(rotated).not.toBe(firstCookie);
  });
});

describe('GET /api/patients', () => {
  it('returns all patients to an anonymous visitor', async () => {
    const response = await patientsRoute();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.patients).toHaveLength(2);
    expect(body.patients[0]).toHaveProperty('dateOfBirth');
  });

  it('returns the same patients to the teacher', async () => {
    const response = await patientsRoute();
    expect(response.status).toBe(200);
    expect((await response.json()).patients).toHaveLength(2);
  });
});

describe('POST /api/auth/logout', () => {
  it('answers 401 without a session', async () => {
    const response = await logoutRoute(jsonRequest('/api/auth/logout', {}));
    expect(response.status).toBe(401);
  });

  it('revokes the session and clears the cookie', async () => {
    const actor: Actor = { type: 'teacher', id: 'teacher', displayName: 'Test-Lehrkraft' };
    const token = (await createSession(actor)).token;
    const response = await logoutRoute(
      jsonRequest('/api/auth/logout', {}, { cookie: `pflege_session=${token}` }),
    );
    expect(response.status).toBe(204);
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('pflege_session=;');
    expect(setCookie).toContain('Max-Age=0');

    const rows = await db.select().from(sessions);
    expect(rows.some((row) => row.idHash === hashSessionToken(token))).toBe(false);
  });
});
