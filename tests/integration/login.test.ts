import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loginAttempts, patients, sessions, studentGroups } from '@/db/schema';
import { HttpError } from '@/lib/api-error';
import {
  GENERIC_LOGIN_FAILURE,
  loginAsTeacher,
  loginWithGroupCode,
  normalizeAccessCode,
} from '@/server/auth/login';
import { hashPassword } from '@/server/auth/password';
import { appDatabase } from '../helpers/database';
import type { Database } from '@/db/client';

let db: Database;

const CODE_A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const CODE_B = 'ZYXWVUTSRQPONMLKJIHGFEDCBA765432';
const INACTIVE_CODE = 'MFRGGZDFMZTWQ2LKNNWG23TPOBYXE43U';

async function expectHttpError(promise: Promise<unknown>, status: number, code?: string) {
  try {
    await promise;
    throw new Error('expected the call to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(status);
    if (code) expect((error as HttpError).code).toBe(code);
  }
}

beforeAll(async () => {
  db = await appDatabase();
  await db.insert(patients).values([
    { id: 'p-1', displayName: 'Frau Albrecht', createdAt: new Date().toISOString() },
    { id: 'p-2', displayName: 'Herr Brandt', createdAt: new Date().toISOString() },
    { id: 'p-3', displayName: 'Frau Czerwenka', createdAt: new Date().toISOString() },
  ]);
  await db.insert(studentGroups).values([
    {
      id: 'g-1',
      displayName: 'Gruppe 1',
      patientId: 'p-1',
      accessCodeHash: hashPassword(CODE_A),
      isActive: 1,
    },
    {
      id: 'g-2',
      displayName: 'Gruppe 2',
      patientId: 'p-2',
      accessCodeHash: hashPassword(CODE_B),
      isActive: 1,
    },
    {
      id: 'g-3',
      displayName: 'Gruppe 3',
      patientId: 'p-3',
      accessCodeHash: hashPassword(INACTIVE_CODE),
      isActive: 0,
    },
  ]);
});

beforeEach(async () => {
  await db.delete(loginAttempts);
  await db.delete(sessions);
});

afterAll(async () => {
  const { closeDatabase } = await import('@/db/client');
  await closeDatabase();
});

describe('group code login', () => {
  it('normalises typed codes', () => {
    expect(normalizeAccessCode(' abcd efgh-2345 ')).toBe('ABCDEFGH2345');
  });

  it('signs a group in and issues a session row', async () => {
    const result = await loginWithGroupCode(CODE_A.toLowerCase(), { ip: '10.0.0.1' });
    expect(result.actor).toMatchObject({ type: 'group', id: 'g-1', patientId: 'p-1' });
    expect(result.session.token).toHaveLength(43);

    const rows = await db.select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.actorId).toBe('g-1');
    expect(rows[0]?.idHash).not.toBe(result.session.token);
  });

  it('refuses an unknown code with the generic message', async () => {
    try {
      await loginWithGroupCode('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', { ip: '10.0.0.2' });
      throw new Error('expected a failure');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(401);
      expect((error as HttpError).message).toBe(GENERIC_LOGIN_FAILURE);
    }
  });

  it('refuses an inactive group even with the right code', async () => {
    await expectHttpError(loginWithGroupCode(INACTIVE_CODE, { ip: '10.0.0.3' }), 401);
  });

  it('reports 429 on the fifth failed attempt in the window', async () => {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expectHttpError(loginWithGroupCode('BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', { ip: '10.0.0.4' }), 401);
    }
    try {
      await loginWithGroupCode('BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', { ip: '10.0.0.4' });
      throw new Error('expected a failure');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(429);
      expect((error as HttpError).code).toBe('RATE_LIMITED');
      expect((error as HttpError).retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it('does not lock a different group out', async () => {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expectHttpError(loginWithGroupCode('CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC', { ip: '10.0.0.5' }), 401);
    }
    const result = await loginWithGroupCode(CODE_B, { ip: '10.0.0.6' });
    expect(result.actor.id).toBe('g-2');
  });

  it('clears the code window after a successful login', async () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await expectHttpError(loginWithGroupCode('DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', { ip: '10.0.0.7' }), 401);
    }
    await loginWithGroupCode(CODE_A, { ip: '10.0.0.8' });

    await expectHttpError(loginWithGroupCode('DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', { ip: '10.0.0.9' }), 401);
    const remaining = await db.select().from(loginAttempts);
    expect(remaining.every((row) => row.count < 5)).toBe(true);
  });
});

describe('teacher login', () => {
  it('accepts the configured teacher password', async () => {
    const result = await loginAsTeacher('lehrer-test-passwort', { ip: '10.0.1.1' });
    expect(result.actor).toMatchObject({ type: 'teacher', id: 'teacher' });
  });

  it('rejects a wrong teacher password', async () => {
    await expectHttpError(loginAsTeacher('falsch', { ip: '10.0.1.2' }), 401);
  });
});
