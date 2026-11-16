import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PATCH as patientPatch } from '@/app/api/patients/[patientId]/route';
import { POST as resetPost } from '@/app/api/admin/reset-class-data/route';
import { auditLog, careReports, patients, vitalEntries } from '@/db/schema';
import { addDays, todayInBerlin } from '@/lib/date';
import { createSession } from '@/server/auth/session';
import { anonymousActor } from '@/server/services/access';
import { createReport } from '@/server/services/reports';
import { createEntries } from '@/server/services/vitals';
import { appDatabase } from '../helpers/database';
import type { Database } from '@/db/client';

let db: Database;
let teacherToken = '';

const ORIGIN = 'http://localhost:3000';
const student = anonymousActor('p-1');

function patchRequest(body: unknown, options: { cookie?: string; origin?: string | null } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.origin !== null) headers.origin = options.origin ?? ORIGIN;
  if (options.cookie) headers.cookie = options.cookie;
  return new Request(`${ORIGIN}/api/patients/p-1`, {
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

const ctx = { params: Promise.resolve({ patientId: 'p-1' }) };
const teacherCookie = () => ({ cookie: `pflege_session=${teacherToken}` });

beforeAll(async () => {
  db = await appDatabase();
  await db.insert(patients).values({
    id: 'p-1',
    displayName: 'Frau Albrecht',
    createdAt: new Date().toISOString(),
  });
  teacherToken = (
    await createSession({ type: 'teacher', id: 'teacher', displayName: 'Test-Lehrkraft' })
  ).token;
});

afterAll(async () => {
  const { closeDatabase } = await import('@/db/client');
  await closeDatabase();
});

describe('PATCH patient details', () => {
  it('answers 401 without a teacher session and changes nothing', async () => {
    const response = await patientPatch(patchRequest({ displayName: 'Herr Berger' }), ctx);
    expect(response.status).toBe(401);
    const rows = await db.select().from(patients);
    expect(rows[0]?.displayName).toBe('Frau Albrecht');
  });

  it('renames a patient and records the change', async () => {
    const response = await patientPatch(
      patchRequest({ displayName: '  Herr Berger  ' }, teacherCookie()),
      ctx,
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.patient.displayName).toBe('Herr Berger');

    const audits = await db.select().from(auditLog);
    expect(
      audits.some(
        (row) =>
          row.entityType === 'patient' &&
          row.action === 'update' &&
          row.actorType === 'teacher' &&
          row.changes.includes('"from":"Frau Albrecht"') &&
          row.changes.includes('"to":"Herr Berger"'),
      ),
    ).toBe(true);
  });

  it('sets and clears the date of birth', async () => {
    const set = await patientPatch(
      patchRequest({ dateOfBirth: '1948-03-07' }, teacherCookie()),
      ctx,
    );
    expect(set.status).toBe(200);
    expect((await set.json()).patient.dateOfBirth).toBe('1948-03-07');

    const cleared = await patientPatch(
      patchRequest({ dateOfBirth: null }, teacherCookie()),
      ctx,
    );
    expect(cleared.status).toBe(200);
    expect((await cleared.json()).patient.dateOfBirth).toBeNull();
  });

  it('rejects an impossible date, a future date and an empty name', async () => {
    const impossible = await patientPatch(
      patchRequest({ dateOfBirth: '1950-02-31' }, teacherCookie()),
      ctx,
    );
    expect(impossible.status).toBe(400);
    expect((await impossible.json()).error.fields.dateOfBirth).toBeTruthy();

    const future = await patientPatch(
      patchRequest({ dateOfBirth: addDays(todayInBerlin(), 1) }, teacherCookie()),
      ctx,
    );
    expect(future.status).toBe(400);

    const blank = await patientPatch(patchRequest({ displayName: '   ' }, teacherCookie()), ctx);
    expect(blank.status).toBe(400);
    expect((await blank.json()).error.fields.displayName).toBeTruthy();

    const rows = await db.select().from(patients);
    expect(rows[0]?.displayName).toBe('Herr Berger');
    expect(rows[0]?.dateOfBirth).toBeNull();
  });

  it('rejects a foreign origin', async () => {
    const response = await patientPatch(
      patchRequest({ displayName: 'Frau Albers' }, { ...teacherCookie(), origin: 'https://evil.example' }),
      ctx,
    );
    expect(response.status).toBe(403);
  });
});

describe('reset route', () => {
  it('refuses a missing origin, a wrong confirmation and no session', async () => {
    expect(
      (await resetPost(resetRequest({ confirm: 'RESET' }, { cookie: `pflege_session=${teacherToken}`, origin: null })))
        .status,
    ).toBe(403);
    expect((await resetPost(resetRequest({ confirm: 'ja' }, teacherCookie()))).status).toBe(400);
    expect((await resetPost(resetRequest({ confirm: 'RESET' }))).status).toBe(401);
  });

  it('resets entries, reports and revisions while keeping patient details', async () => {
    await patientPatch(
      patchRequest({ displayName: 'Frau Albers', dateOfBirth: '1941-05-05' }, teacherCookie()),
      ctx,
    );
    await createEntries(student, 'p-1', {
      category: 'puls',
      values: { pulse: 70 },
      date: '2026-11-12',
      time: '09:00',
    });
    await createReport(student, 'p-1', {
      observedDate: '2026-11-12',
      observedTime: '10:00',
      shift: 'spaet',
      body: 'Wird beim Zurücksetzen gelöscht.',
    });

    const response = await resetPost(resetRequest({ confirm: 'RESET' }, teacherCookie()));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.deleted.entries).toBe(1);
    expect(payload.deleted.reports).toBe(1);

    expect(await db.select().from(vitalEntries)).toHaveLength(0);
    expect(await db.select().from(careReports)).toHaveLength(0);

    const rows = await db.select().from(patients);
    expect(rows[0]?.displayName).toBe('Frau Albers');
    expect(rows[0]?.dateOfBirth).toBe('1941-05-05');
  });
});
