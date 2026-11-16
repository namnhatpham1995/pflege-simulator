import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { patients, sessions, studentGroups } from '@/db/schema';
import { HttpError } from '@/lib/api-error';
import {
  hashSessionToken,
  requireActor,
  SESSION_ABSOLUTE_TIMEOUT_MS,
  SESSION_IDLE_TIMEOUT_MS,
} from '@/server/auth/session';
import { assertSameOrigin, requirePatientAccess, requireTeacher } from '@/server/services/access';
import { appDatabase } from '../helpers/database';
import type { Database } from '@/db/client';

let db: Database;

const patientA = { id: 'p-a', displayName: 'Frau Albrecht' };
const patientB = { id: 'p-b', displayName: 'Herr Brandt' };
const groupA = { id: 'g-a', displayName: 'Gruppe 1' };

const groupToken = 'group-token-for-tests';
const teacherToken = 'teacher-token-for-tests';

function requestWithToken(url: string, token?: string, origin?: string): Request {
  const headers: Record<string, string> = {};
  if (token) headers.cookie = `pflege_session=${token}`;
  if (origin) headers.origin = origin;
  return new Request(url, { headers });
}

async function expectHttpError(promise: Promise<unknown>, status: number, code: string) {
  try {
    await promise;
    throw new Error('expected the call to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(status);
    expect((error as HttpError).code).toBe(code);
  }
}

beforeAll(async () => {
  db = await appDatabase();
  const now = new Date();

  await db.insert(patients).values([
    { ...patientA, createdAt: now.toISOString() },
    { ...patientB, createdAt: now.toISOString() },
  ]);
  await db.insert(studentGroups).values({
    id: groupA.id,
    displayName: groupA.displayName,
    patientId: patientA.id,
    accessCodeHash: 'scrypt$16384$8$1$00112233445566778899aabbccddeeff$' + 'a'.repeat(64),
    isActive: 1,
  });

  await db.insert(sessions).values([
    {
      idHash: hashSessionToken(groupToken),
      actorType: 'group',
      actorId: groupA.id,
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_TIMEOUT_MS).toISOString(),
    },
    {
      idHash: hashSessionToken(teacherToken),
      actorType: 'teacher',
      actorId: 'teacher',
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_TIMEOUT_MS).toISOString(),
    },
  ]);
});

afterAll(async () => {
  const { closeDatabase } = await import('@/db/client');
  await closeDatabase();
});

describe('authorisation matrix', () => {
  it('refuses an anonymous request with 401', async () => {
    await expectHttpError(
      requirePatientAccess(patientA.id, requestWithToken('http://localhost/api')),
      401,
      'UNAUTHENTICATED',
    );
  });

  it('lets a group read its own patient', async () => {
    const access = await requirePatientAccess(
      patientA.id,
      requestWithToken('http://localhost/api', groupToken),
    );
    expect(access.actor.type).toBe('group');
    expect(access.patient.id).toBe(patientA.id);
  });

  it("refuses another group's patient with 403", async () => {
    await expectHttpError(
      requirePatientAccess(patientB.id, requestWithToken('http://localhost/api', groupToken)),
      403,
      'FORBIDDEN',
    );
  });

  it('lets the teacher read any patient but refuses the teacher console to a group', async () => {
    const access = await requirePatientAccess(
      patientB.id,
      requestWithToken('http://localhost/api', teacherToken),
    );
    expect(access.actor.type).toBe('teacher');

    await expectHttpError(
      requireTeacher(requestWithToken('http://localhost/api', groupToken)),
      403,
      'FORBIDDEN',
    );
    const teacher = await requireTeacher(requestWithToken('http://localhost/api', teacherToken));
    expect(teacher.id).toBe('teacher');
  });

  it('resolves the group actor with its assigned patient id', async () => {
    const actor = await requireActor(requestWithToken('http://localhost/api', groupToken));
    expect(actor).toMatchObject({ type: 'group', id: groupA.id, patientId: patientA.id });
  });

  it('rejects an expired session', async () => {
    const expiredToken = 'expired-token';
    const now = new Date();
    await db.insert(sessions).values({
      idHash: hashSessionToken(expiredToken),
      actorType: 'teacher',
      actorId: 'teacher',
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      expiresAt: new Date(now.getTime() - 1_000).toISOString(),
    });
    await expectHttpError(
      requireActor(requestWithToken('http://localhost/api', expiredToken)),
      401,
      'UNAUTHENTICATED',
    );
  });

  it('rejects a session idle for longer than eight hours', async () => {
    const idleToken = 'idle-token';
    const now = new Date();
    await db.insert(sessions).values({
      idHash: hashSessionToken(idleToken),
      actorType: 'teacher',
      actorId: 'teacher',
      createdAt: now.toISOString(),
      lastSeenAt: new Date(now.getTime() - SESSION_IDLE_TIMEOUT_MS - 60_000).toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_TIMEOUT_MS).toISOString(),
    });
    await expectHttpError(
      requireActor(requestWithToken('http://localhost/api', idleToken)),
      401,
      'UNAUTHENTICATED',
    );
  });
});

describe('origin check', () => {
  it('accepts a same-origin mutation', () => {
    expect(() =>
      assertSameOrigin(
        requestWithToken('http://localhost:3000/api/patients', undefined, 'http://localhost:3000'),
      ),
    ).not.toThrow();
  });

  it('rejects a missing origin', () => {
    expect(() => assertSameOrigin(requestWithToken('http://localhost:3000/api/patients'))).toThrow(
      /nicht von dieser Anwendung/,
    );
  });

  it('rejects a foreign origin', () => {
    expect(() =>
      assertSameOrigin(
        requestWithToken('http://localhost:3000/api/patients', undefined, 'https://evil.example'),
      ),
    ).toThrow(/nicht von dieser Anwendung/);
  });
});
