import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as requirementsGet, PATCH as requirementsPatch } from '@/app/api/patients/[patientId]/requirements/route';
import { POST as resetPost } from '@/app/api/admin/reset-class-data/route';
import { careReports, patients, studentGroups } from '@/db/schema';
import type { Actor } from '@/lib/types';
import { createSession } from '@/server/auth/session';
import { createReport } from '@/server/services/reports';
import { appDatabase } from '../helpers/database';
import type { Database } from '@/db/client';

let db: Database;
let groupToken = '';
let teacherToken = '';

const ORIGIN = 'http://localhost:3000';
const group: Actor = { type: 'group', id: 'g-1', displayName: 'Gruppe 1', patientId: 'p-1' };
const teacher: Actor = { type: 'teacher', id: 'teacher', displayName: 'Test-Lehrkraft' };

const cookies = (token: string) => ({ cookie: `pflege_session=${token}` });
const ctx = { params: Promise.resolve({ patientId: 'p-1' }) };

function requirementRequest(body: unknown, options: { cookie?: string; origin?: string | null } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.origin !== null) headers.origin = options.origin ?? ORIGIN;
  if (options.cookie) headers.cookie = options.cookie;
  return new Request(`${ORIGIN}/api/patients/p-1/requirements`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

function resetRequest(body: unknown, options: { cookie?: string; origin?: string | null } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.origin !== null) headers.origin = options.origin ?? ORIGIN;
  if (options.cookie) headers.cookie = options.cookie;
  return new Request(`${ORIGIN}/api/admin/reset-class-data`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  db = await appDatabase();
  const now = new Date().toISOString();
  await db.insert(patients).values({ id: 'p-1', displayName: 'Frau Albrecht', createdAt: now });
  await db.insert(studentGroups).values({
    id: 'g-1',
    displayName: 'Gruppe 1',
    patientId: 'p-1',
    accessCodeHash: 'scrypt$1$1$1$00$00',
    isActive: 1,
  });
  groupToken = (await createSession(group)).token;
  teacherToken = (await createSession(teacher)).token;
});

afterAll(async () => {
  const { closeDatabase } = await import('@/db/client');
  await closeDatabase();
});

describe('requirements route', () => {
  it('answers 401 without a session and 200 for a group reading its own patient', async () => {
    const unauth = await requirementsGet(
      new Request(`${ORIGIN}/api/patients/p-1/requirements`),
      ctx,
    );
    expect(unauth.status).toBe(401);

    const response = await requirementsGet(
      new Request(`${ORIGIN}/api/patients/p-1/requirements`, { headers: cookies(groupToken) }),
      ctx,
    );
    expect(response.status).toBe(200);
    expect((await response.json()).requirements.systolic).toBe(true);
  });

  it('refuses a group edit with 403 and accepts the teacher', async () => {
    const refused = await requirementsPatch(
      requirementRequest({ field: 'temperature', expected: true }, cookies(groupToken)),
      ctx,
    );
    expect(refused.status).toBe(403);

    const accepted = await requirementsPatch(
      requirementRequest({ field: 'temperature', expected: true }, cookies(teacherToken)),
      ctx,
    );
    expect(accepted.status).toBe(200);
    expect((await accepted.json()).requirements.temperature).toBe(true);
  });

  it('rejects a foreign origin and an unknown field', async () => {
    const foreign = await requirementsPatch(
      requirementRequest(
        { field: 'temperature', expected: false },
        { ...cookies(teacherToken), origin: 'https://evil.example' },
      ),
      ctx,
    );
    expect(foreign.status).toBe(403);

    const unknown = await requirementsPatch(
      requirementRequest({ field: 'spo2', expected: true }, cookies(teacherToken)),
      ctx,
    );
    expect(unknown.status).toBe(400);
  });
});

describe('reset route', () => {
  it('refuses a group, a missing origin and a wrong confirmation', async () => {
    expect((await resetPost(resetRequest({ confirm: 'RESET' }, cookies(groupToken)))).status).toBe(403);
    expect(
      (await resetPost(resetRequest({ confirm: 'RESET' }, { cookie: `pflege_session=${teacherToken}`, origin: null })))
        .status,
    ).toBe(403);
    expect((await resetPost(resetRequest({ confirm: 'ja' }, cookies(teacherToken)))).status).toBe(400);
  });

  it('resets and reports the deleted counts', async () => {
    await createReport(group, 'p-1', {
      observedDate: '2026-11-12',
      observedTime: '10:00',
      shift: 'spaet',
      body: 'Wird beim Zurücksetzen gelöscht.',
    });

    const response = await resetPost(resetRequest({ confirm: 'RESET' }, cookies(teacherToken)));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.deleted.reports).toBe(1);
    expect(await db.select().from(careReports)).toHaveLength(0);
  });
});
