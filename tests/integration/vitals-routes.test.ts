import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as rangeRoute from '@/app/api/patients/[patientId]/vitals/route';
import {
  GET as getDay,
  PATCH as patchDay,
} from '@/app/api/patients/[patientId]/vitals/[date]/route';
import { patients, studentGroups } from '@/db/schema';
import { createSession } from '@/server/auth/session';
import type { Actor } from '@/lib/types';
import { appDatabase } from '../helpers/database';
import type { Database } from '@/db/client';

let db: Database;
let groupToken = '';
let teacherToken = '';

const ORIGIN = 'http://localhost:3000';

function ctx(patientId: string, date: string) {
  return { params: Promise.resolve({ patientId, date }) };
}

function patchRequest(date: string, body: unknown, options: { cookie?: string; origin?: string | null } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.origin !== null) headers.origin = options.origin ?? ORIGIN;
  if (options.cookie) headers.cookie = options.cookie;
  return new Request(`${ORIGIN}/api/patients/p-1/vitals/${date}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  db = await appDatabase();
  const now = new Date().toISOString();
  await db.insert(patients).values([
    { id: 'p-1', displayName: 'Frau Albrecht', createdAt: now },
    { id: 'p-2', displayName: 'Herr Brandt', createdAt: now },
  ]);
  await db.insert(studentGroups).values([
    { id: 'g-1', displayName: 'Gruppe 1', patientId: 'p-1', accessCodeHash: 'scrypt$1$1$1$00$00', isActive: 1 },
    { id: 'g-2', displayName: 'Gruppe 2', patientId: 'p-2', accessCodeHash: 'scrypt$1$1$1$00$00', isActive: 1 },
  ]);

  const group: Actor = { type: 'group', id: 'g-1', displayName: 'Gruppe 1', patientId: 'p-1' };
  const teacher: Actor = { type: 'teacher', id: 'teacher', displayName: 'Test-Lehrkraft' };
  groupToken = (await createSession(group)).token;
  teacherToken = (await createSession(teacher)).token;
});

afterAll(async () => {
  const { closeDatabase } = await import('@/db/client');
  await closeDatabase();
});

const groupCookie = () => ({ cookie: `pflege_session=${groupToken}` });

describe('GET vitals routes', () => {
  it('answers 401 without a session', async () => {
    const response = await getDay(
      new Request(`${ORIGIN}/api/patients/p-1/vitals/2026-11-10`),
      ctx('p-1', '2026-11-10'),
    );
    expect(response.status).toBe(401);
  });

  it('returns an empty day with version 0 without creating a record', async () => {
    const response = await getDay(
      new Request(`${ORIGIN}/api/patients/p-1/vitals/2026-11-10`, { headers: groupCookie() }),
      ctx('p-1', '2026-11-10'),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ record: null, version: 0 });
  });

  it("answers 403 for another group's patient", async () => {
    const response = await getDay(
      new Request(`${ORIGIN}/api/patients/p-2/vitals/2026-11-10`, { headers: groupCookie() }),
      ctx('p-2', '2026-11-10'),
    );
    expect(response.status).toBe(403);
  });

  it('rejects an invalid date with 400', async () => {
    const response = await getDay(
      new Request(`${ORIGIN}/api/patients/p-1/vitals/2027-02-29`, { headers: groupCookie() }),
      ctx('p-1', '2027-02-29'),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION');
  });

  it('requires from and to on the range route', async () => {
    const response = await rangeRoute.GET(
      new Request(`${ORIGIN}/api/patients/p-1/vitals`, { headers: groupCookie() }),
      { params: Promise.resolve({ patientId: 'p-1' }) },
    );
    expect(response.status).toBe(400);
  });

  it('returns a range with requirements', async () => {
    const response = await rangeRoute.GET(
      new Request(`${ORIGIN}/api/patients/p-1/vitals?from=2026-11-10&to=2026-11-16`, {
        headers: groupCookie(),
      }),
      { params: Promise.resolve({ patientId: 'p-1' }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.records)).toBe(true);
    expect(body.requirements).toHaveProperty('systolic', true);
  });

  it('exposes no POST on the range route', () => {
    expect('POST' in rangeRoute).toBe(false);
  });
});

describe('PATCH vitals route', () => {
  it('rejects a foreign origin with 403 ORIGIN', async () => {
    const response = await patchDay(
      patchRequest('2026-11-10', { version: 0, values: {} }, { ...groupCookie(), origin: 'https://evil.example' }),
      ctx('p-1', '2026-11-10'),
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe('ORIGIN');
  });

  it('rejects a missing origin', async () => {
    const response = await patchDay(
      patchRequest('2026-11-10', { version: 0, values: {} }, { ...groupCookie(), origin: null }),
      ctx('p-1', '2026-11-10'),
    );
    expect(response.status).toBe(403);
  });

  it('rejects an unknown key with 400', async () => {
    const response = await patchDay(
      patchRequest('2026-11-10', { version: 0, values: { shift: 'frueh' } }, groupCookie()),
      ctx('p-1', '2026-11-10'),
    );
    expect(response.status).toBe(400);
  });

  it('saves a day and then reports a conflict with the current record', async () => {
    const first = await patchDay(
      patchRequest('2026-11-20', { version: 0, values: { systolic: 120, diastolic: 80, pulse: 72 } }, groupCookie()),
      ctx('p-1', '2026-11-20'),
    );
    expect(first.status).toBe(200);
    const saved = await first.json();
    expect(saved.version).toBe(1);

    const stale = await patchDay(
      patchRequest('2026-11-20', { version: 0, values: { pulse: 80 } }, groupCookie()),
      ctx('p-1', '2026-11-20'),
    );
    expect(stale.status).toBe(409);
    const conflict = await stale.json();
    expect(conflict.error.code).toBe('CONFLICT');
    expect(conflict.current.version).toBe(1);
    expect(conflict.current.record.pulseBpm).toBe(72);
  });

  it('refuses the teacher with 403', async () => {
    const response = await patchDay(
      patchRequest('2026-11-21', { version: 0, values: { pulse: 70 } }, { cookie: `pflege_session=${teacherToken}` }),
      ctx('p-1', '2026-11-21'),
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });
});
