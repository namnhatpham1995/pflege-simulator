import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { patients, sessions } from '@/db/schema';
import { HttpError } from '@/lib/api-error';
import type { Actor } from '@/lib/types';
import {
  hashSessionToken,
  requireActor,
  SESSION_ABSOLUTE_TIMEOUT_MS,
  SESSION_IDLE_TIMEOUT_MS,
} from '@/server/auth/session';
import {
  anonymousActor,
  assertSameOrigin,
  assertStudentWrite,
  requirePatientAccess,
  requireTeacher,
} from '@/server/services/access';
import { appDatabase } from '../helpers/database';
import type { Database } from '@/db/client';

let db: Database;

const patientA = { id: 'p-a', displayName: 'Frau Albrecht' };
const patientB = { id: 'p-b', displayName: 'Herr Brandt' };

const teacherToken = 'teacher-token-for-tests';
const legacyGroupToken = 'legacy-group-token';

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
    { ...patientA, dateOfBirth: '1948-03-07', createdAt: now.toISOString() },
    { ...patientB, createdAt: now.toISOString() },
  ]);

  await db.insert(sessions).values([
    {
      idHash: hashSessionToken(teacherToken),
      actorType: 'teacher',
      actorId: 'teacher',
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_TIMEOUT_MS).toISOString(),
    },
    {
      idHash: hashSessionToken(legacyGroupToken),
      actorType: 'group',
      actorId: 'g-old',
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

describe('open patient access', () => {
  it('lets an anonymous visitor read any patient with an anonymous student actor', async () => {
    const access = await requirePatientAccess(patientA.id, requestWithToken('http://localhost/api'));
    expect(access.actor).toMatchObject({
      type: 'group',
      id: `patient:${patientA.id}`,
      patientId: patientA.id,
    });
    expect(access.patient).toMatchObject({
      id: patientA.id,
      dateOfBirth: '1948-03-07',
    });
  });

  it('answers 404 for an unknown patient', async () => {
    await expectHttpError(
      requirePatientAccess('missing', requestWithToken('http://localhost/api')),
      404,
      'NOT_FOUND',
    );
  });

  it('lets the teacher read every patient', async () => {
    const access = await requirePatientAccess(
      patientB.id,
      requestWithToken('http://localhost/api', teacherToken),
    );
    expect(access.actor.type).toBe('teacher');
  });

  it('ignores an old group session instead of granting a group actor', async () => {
    const access = await requirePatientAccess(
      patientB.id,
      requestWithToken('http://localhost/api', legacyGroupToken),
    );
    expect(access.actor.id).toBe(`patient:${patientB.id}`);
  });

  it('refuses teacher writes while students may write', () => {
    expect(() => assertStudentWrite(anonymousActor(patientA.id))).not.toThrow();
    const teacher: Actor = { type: 'teacher', id: 'teacher', displayName: 'Lehrkraft' };
    expect(() => assertStudentWrite(teacher)).toThrow(HttpError);
  });

  it('answers 401 on teacher surfaces without a session and allows the teacher', async () => {
    await expectHttpError(
      requireTeacher(requestWithToken('http://localhost/api')),
      401,
      'UNAUTHENTICATED',
    );
    const teacher = await requireTeacher(requestWithToken('http://localhost/api', teacherToken));
    expect(teacher.id).toBe('teacher');
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
