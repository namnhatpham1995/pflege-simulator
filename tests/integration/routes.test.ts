import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { POST as logoutRoute } from '@/app/api/auth/logout/route';
import { GET as patientsRoute } from '@/app/api/patients/route';
import { loginAttempts, patients, sessions, studentGroups } from '@/db/schema';
import { hashPassword } from '@/server/auth/password';
import { createSession } from '@/server/auth/session';
import type { Actor } from '@/lib/types';
import { appDatabase } from '../helpers/database';
import type { Database } from '@/db/client';

let db: Database;
let groupToken = '';
let teacherToken = '';

const CODE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
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
    { id: 'p-2', displayName: 'Herr Brandt', createdAt: new Date().toISOString() },
  ]);
  await db.insert(studentGroups).values({
    id: 'g-1',
    displayName: 'Gruppe 1',
    patientId: 'p-1',
    accessCodeHash: hashPassword(CODE),
    isActive: 1,
  });

  const groupActor: Actor = { type: 'group', id: 'g-1', displayName: 'Gruppe 1', patientId: 'p-1' };
  const teacherActor: Actor = { type: 'teacher', id: 'teacher', displayName: 'Test-Lehrkraft' };
  groupToken = (await createSession(groupActor)).token;
  teacherToken = (await createSession(teacherActor)).token;
});

afterAll(async () => {
  const { closeDatabase } = await import('@/db/client');
  await closeDatabase();
});

describe('POST /api/auth/login', () => {
  it('rejects a foreign origin before touching credentials', async () => {
    const response = await loginRoute(
      jsonRequest('/api/auth/login', { mode: 'group', code: CODE }, { origin: 'https://evil.example' }),
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe('ORIGIN');
  });

  it('rejects a missing origin', async () => {
    const response = await loginRoute(
      jsonRequest('/api/auth/login', { mode: 'group', code: CODE }, { origin: null }),
    );
    expect(response.status).toBe(403);
  });

  it('rejects an invalid body', async () => {
    const response = await loginRoute(jsonRequest('/api/auth/login', { mode: 'group', shift: 'frueh' }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION');
  });

  it('returns 401 for a wrong code', async () => {
    await db.delete(loginAttempts);
    const response = await loginRoute(
      jsonRequest('/api/auth/login', { mode: 'group', code: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }),
    );
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.message).toBe('Zugangscode oder Passwort ist falsch.');
  });

  it('signs in and sets an HttpOnly session cookie', async () => {
    await db.delete(loginAttempts);
    const response = await loginRoute(
      jsonRequest('/api/auth/login', { mode: 'group', code: CODE }),
    );
    expect(response.status).toBe(200);
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('pflege_session=');
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
    const body = await response.json();
    expect(body.actor).toMatchObject({ type: 'group', patientId: 'p-1' });
  });

  it('rotates an existing session cookie', async () => {
    const first = await loginRoute(jsonRequest('/api/auth/login', { mode: 'group', code: CODE }));
    const firstCookie = (first.headers.get('set-cookie') ?? '').split(';')[0]!;
    const second = await loginRoute(
      jsonRequest('/api/auth/login', { mode: 'group', code: CODE }, { cookie: firstCookie }),
    );
    expect(second.status).toBe(200);
    const rotated = (second.headers.get('set-cookie') ?? '').split(';')[0]!;
    expect(rotated).not.toBe(firstCookie);

    const oldToken = firstCookie.split('=')[1]!;
    const oldSession = await db.select().from(sessions);
    expect(oldSession.some((row) => row.idHash.includes(oldToken))).toBe(false);
  });
});

describe('GET /api/patients', () => {
  it('answers 401 JSON for an anonymous request', async () => {
    const response = await patientsRoute(new Request(`${ORIGIN}/api/patients`));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns only the assigned patient for a group', async () => {
    const response = await patientsRoute(
      new Request(`${ORIGIN}/api/patients`, { headers: { cookie: `pflege_session=${groupToken}` } }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.patients).toHaveLength(1);
    expect(body.patients[0].id).toBe('p-1');
  });

  it('returns every patient for the teacher', async () => {
    const response = await patientsRoute(
      new Request(`${ORIGIN}/api/patients`, { headers: { cookie: `pflege_session=${teacherToken}` } }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.patients).toHaveLength(2);
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

    const after = await patientsRoute(
      new Request(`${ORIGIN}/api/patients`, { headers: { cookie: `pflege_session=${token}` } }),
    );
    expect(after.status).toBe(401);
  });
});
