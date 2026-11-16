import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as getRange, POST as createEntry } from '@/app/api/patients/[patientId]/vitals/route';
import { DELETE as deleteEntry } from '@/app/api/patients/[patientId]/vitals/[submissionId]/route';
import { patients, vitalEntries } from '@/db/schema';
import { createSession } from '@/server/auth/session';
import type { Actor } from '@/lib/types';
import { appDatabase } from '../helpers/database';
import type { Database } from '@/db/client';

let db: Database;
let teacherToken = '';
let submissionId = '';

const ORIGIN = 'http://localhost:3000';

function ctx(patientId: string, submission = '') {
  return { params: Promise.resolve({ patientId, submissionId: submission }) };
}

function post(body: unknown, options: { cookie?: string; origin?: string | null } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.origin !== null) headers.origin = options.origin ?? ORIGIN;
  if (options.cookie) headers.cookie = options.cookie;
  return new Request(`${ORIGIN}/api/patients/p-1/vitals`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function remove(options: { cookie?: string; origin?: string | null } = {}) {
  const headers: Record<string, string> = {};
  if (options.origin !== null) headers.origin = options.origin ?? ORIGIN;
  if (options.cookie) headers.cookie = options.cookie;
  return new Request(`${ORIGIN}/api/patients/p-1/vitals/${submissionId}`, {
    method: 'DELETE',
    headers,
  });
}

beforeAll(async () => {
  db = await appDatabase();
  const now = new Date().toISOString();
  await db.insert(patients).values([
    { id: 'p-1', displayName: 'Frau Albrecht', createdAt: now },
    { id: 'p-2', displayName: 'Herr Brandt', createdAt: now },
  ]);
  const teacher: Actor = { type: 'teacher', id: 'teacher', displayName: 'Test-Lehrkraft' };
  teacherToken = (await createSession(teacher)).token;
});

afterAll(async () => {
  const { closeDatabase } = await import('@/db/client');
  await closeDatabase();
});

describe('GET vitals route', () => {
  it('requires from and to', async () => {
    const response = await getRange(
      new Request(`${ORIGIN}/api/patients/p-1/vitals`),
      ctx('p-1'),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('VALIDATION');
  });

  it('serves an anonymous range read', async () => {
    const response = await getRange(
      new Request(`${ORIGIN}/api/patients/p-1/vitals?from=2026-11-10&to=2026-11-16`),
      ctx('p-1'),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ entries: [] });
  });

  it('answers 404 for an unknown patient', async () => {
    const response = await getRange(
      new Request(`${ORIGIN}/api/patients/missing/vitals?from=2026-11-10&to=2026-11-16`),
      ctx('missing'),
    );
    expect(response.status).toBe(404);
  });
});

describe('POST vitals route', () => {
  it('rejects a foreign or missing origin', async () => {
    const foreign = await createEntry(
      post({ category: 'puls', values: { pulse: 70 }, date: '2026-11-12', time: '09:15' }, { origin: 'https://evil.example' }),
      ctx('p-1'),
    );
    expect(foreign.status).toBe(403);
    expect((await foreign.json()).error.code).toBe('ORIGIN');

    const missing = await createEntry(
      post({ category: 'puls', values: { pulse: 70 }, date: '2026-11-12', time: '09:15' }, { origin: null }),
      ctx('p-1'),
    );
    expect(missing.status).toBe(403);
  });

  it('creates an anonymous entry with 201', async () => {
    const response = await createEntry(
      post({ category: 'blutdruck', values: { systolic: 120, diastolic: 80 }, date: '2026-11-12', time: '08:00' }),
      ctx('p-1'),
    );
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.entries).toHaveLength(2);
    expect(payload.groups[0].values).toEqual({ systolic: 120, diastolic: 80 });
    submissionId = payload.entries[0].submissionId;
  });

  it('rejects an invalid pair without writing a row', async () => {
    const response = await createEntry(
      post({ category: 'blutdruck', values: { systolic: 120 }, date: '2026-11-12', time: '09:00' }),
      ctx('p-1'),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.fields.diastolic).toBeTruthy();
  });

  it('refuses the teacher with 403', async () => {
    const response = await createEntry(
      post(
        { category: 'puls', values: { pulse: 70 }, date: '2026-11-12', time: '10:00' },
        { cookie: `pflege_session=${teacherToken}` },
      ),
      ctx('p-1'),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('FORBIDDEN');
  });
});

describe('DELETE vitals route', () => {
  it('deletes the submission and answers 404 the second time', async () => {
    const first = await deleteEntry(remove(), ctx('p-1', submissionId));
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({ deleted: 2 });

    const second = await deleteEntry(remove(), ctx('p-1', submissionId));
    expect(second.status).toBe(404);
  });

  it('refuses the teacher with 403', async () => {
    const created = await createEntry(
      post({ category: 'puls', values: { pulse: 66 }, date: '2026-11-12', time: '11:00' }),
      ctx('p-1'),
    );
    const payload = await created.json();
    const id = payload.entries[0].submissionId;

    const response = await deleteEntry(
      remove({ cookie: `pflege_session=${teacherToken}` }),
      ctx('p-1', id),
    );
    expect(response.status).toBe(403);
    expect(await db.select().from(vitalEntries)).toHaveLength(1);
  });
});
