import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  auditLog,
  careReportRevisions,
  careReports,
  patients,
  vitalEntries,
} from '@/db/schema';
import { HttpError } from '@/lib/api-error';
import type { Actor } from '@/lib/types';
import { anonymousActor } from '@/server/services/access';
import { createReport, updateReport } from '@/server/services/reports';
import { resetClassData } from '@/server/services/reset';
import { createEntries } from '@/server/services/vitals';
import { appDatabase } from '../helpers/database';
import type { Database } from '@/db/client';

let db: Database;

const student = anonymousActor('p-1');
const teacher: Actor = { type: 'teacher', id: 'teacher', displayName: 'Lehrkraft' };

async function expectStatus(promise: Promise<unknown>, status: number) {
  try {
    await promise;
    throw new Error('expected the call to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(status);
    return error as HttpError;
  }
}

beforeAll(async () => {
  db = await appDatabase();
  await db.insert(patients).values({
    id: 'p-1',
    displayName: 'Frau Albrecht',
    dateOfBirth: '1948-03-07',
    createdAt: new Date().toISOString(),
  });
});

afterAll(async () => {
  const { closeDatabase } = await import('@/db/client');
  await closeDatabase();
});

describe('resetClassData', () => {
  it('deletes entries, reports, revisions and audit in one transaction', async () => {
    await createEntries(student, 'p-1', {
      category: 'puls',
      values: { pulse: 70 },
      date: '2026-11-10',
      time: '08:00',
    });
    await createEntries(student, 'p-1', {
      category: 'blutdruck',
      values: { systolic: 120, diastolic: 80 },
      date: '2026-11-10',
      time: '09:00',
    });

    const report = await createReport(student, 'p-1', {
      observedDate: '2026-11-10',
      observedTime: '08:00',
      shift: 'frueh',
      body: 'Ausgangstext.',
    });
    await updateReport(student, 'p-1', report.id, { version: 1, body: 'Korrigiert.' });

    const deleted = await resetClassData(teacher, 'RESET');
    expect(deleted.entries).toBe(3);
    expect(deleted.reports).toBe(1);
    expect(deleted.revisions).toBe(1);
    expect(deleted.audit).toBeGreaterThanOrEqual(4);

    expect(await db.select().from(vitalEntries)).toHaveLength(0);
    expect(await db.select().from(careReports)).toHaveLength(0);
    expect(await db.select().from(careReportRevisions)).toHaveLength(0);
    expect(await db.select().from(auditLog)).toHaveLength(0);
  });

  it('keeps the patients with their names and dates of birth', async () => {
    const rows = await db.select().from(patients);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.displayName).toBe('Frau Albrecht');
    expect(rows[0]?.dateOfBirth).toBe('1948-03-07');
  });

  it('refuses a wrong confirmation and a non-teacher actor', async () => {
    await expectStatus(resetClassData(teacher, 'reset'), 400);
    await expectStatus(resetClassData(student, 'RESET'), 403);
  });
});
