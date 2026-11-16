import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loginAttempts, sessions } from '@/db/schema';
import { HttpError } from '@/lib/api-error';
import { resetEnvCache } from '@/lib/env';
import { GENERIC_LOGIN_FAILURE, loginAsTeacher } from '@/server/auth/login';
import { appDatabase } from '../helpers/database';
import type { Database } from '@/db/client';

let db: Database;
const originalPassword = process.env.TEACHER_PASSWORD;
const originalSecret = process.env.SESSION_SECRET;

async function expectHttpError(promise: Promise<unknown>, status: number, code?: string) {
  try {
    await promise;
    throw new Error('expected the call to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(status);
    if (code) expect((error as HttpError).code).toBe(code);
    return error as HttpError;
  }
}

beforeAll(async () => {
  db = await appDatabase();
});

beforeEach(async () => {
  await db.delete(loginAttempts);
  await db.delete(sessions);
});

afterEach(() => {
  process.env.TEACHER_PASSWORD = originalPassword;
  process.env.SESSION_SECRET = originalSecret;
  resetEnvCache();
});

afterAll(async () => {
  const { closeDatabase } = await import('@/db/client');
  await closeDatabase();
});

describe('teacher login', () => {
  it('accepts the configured teacher password and issues a session', async () => {
    const result = await loginAsTeacher('lehrer-test-passwort', { ip: '10.0.1.1' });
    expect(result.actor).toMatchObject({ type: 'teacher', id: 'teacher' });
    expect(result.session.token).toHaveLength(43);

    const rows = await db.select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.actorType).toBe('teacher');
    expect(rows[0]?.idHash).not.toBe(result.session.token);
  });

  it('accepts a short, simple phrase', async () => {
    process.env.TEACHER_PASSWORD = 'kurz';
    resetEnvCache();

    const result = await loginAsTeacher('kurz', { ip: '10.0.1.2' });
    expect(result.actor.type).toBe('teacher');
  });

  it('rejects a wrong password with one generic 401 and no cookie data', async () => {
    const error = await expectHttpError(loginAsTeacher('falsch', { ip: '10.0.1.3' }), 401, 'UNAUTHENTICATED');
    expect(error.message).toBe(GENERIC_LOGIN_FAILURE);
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it('reports 429 with a retry time on the fifth failed attempt', async () => {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expectHttpError(loginAsTeacher('falsch', { ip: '10.0.1.4' }), 401);
    }
    const error = await expectHttpError(
      loginAsTeacher('falsch', { ip: '10.0.1.4' }),
      429,
      'RATE_LIMITED',
    );
    expect(error.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('keeps a correct password from bypassing an exhausted window', async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await expectHttpError(loginAsTeacher('falsch', { ip: '10.0.1.5' }), attempt === 5 ? 429 : 401);
    }
    await expectHttpError(loginAsTeacher('lehrer-test-passwort', { ip: '10.0.1.5' }), 429);
  });

  it('clears the failure counter after a successful login', async () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await expectHttpError(loginAsTeacher('falsch', { ip: '10.0.1.6' }), 401);
    }
    await loginAsTeacher('lehrer-test-passwort', { ip: '10.0.1.6' });

    const remaining = await db.select().from(loginAttempts);
    expect(remaining.every((row) => row.key !== 'code:teacher')).toBe(true);

    await expectHttpError(loginAsTeacher('falsch', { ip: '10.0.1.7' }), 401);
  });
});
