import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  auditLog,
  careReportRevisions,
  careReports,
  measurementRequirements,
  patients,
  studentGroups,
  vitalDailyRecords,
} from '@/db/schema';
import { HttpError } from '@/lib/api-error';
import type { Actor } from '@/lib/types';
import { createReport, updateReport } from '@/server/services/reports';
import { resetClassData } from '@/server/services/reset';
import { saveVitalsDay } from '@/server/services/vitals';
import { appDatabase } from '../helpers/database';
import type { Database } from '@/db/client';

let db: Database;

const group: Actor = { type: 'group', id: 'g-1', displayName: 'Gruppe 1', patientId: 'p-1' };
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
  const now = new Date().toISOString();
  await db.insert(patients).values({ id: 'p-1', displayName: 'Frau Albrecht', createdAt: now });
  await db.insert(studentGroups).values({
    id: 'g-1',
    displayName: 'Gruppe 1',
    patientId: 'p-1',
    accessCodeHash: 'scrypt$1$1$1$00$00',
    isActive: 1,
  });
  await db
    .insert(measurementRequirements)
    .values({ patientId: 'p-1', field: 'glucose', isExpected: 1 });
});

afterAll(async () => {
  const { closeDatabase } = await import('@/db/client');
  await closeDatabase();
});

describe('resetClassData', () => {
  it('deletes vitals, reports, revisions and audit in one transaction', async () => {
    await saveVitalsDay(group, 'p-1', '2026-11-10', {
      version: 0,
      values: { systolic: 120, diastolic: 80, pulse: 70 },
    });
    await saveVitalsDay(group, 'p-1', '2026-11-11', {
      version: 0,
      values: { systolic: 118, diastolic: 78, pulse: 72 },
    });

    const report = await createReport(group, 'p-1', {
      observedDate: '2026-11-10',
      observedTime: '08:00',
      shift: 'frueh',
      body: 'Ausgangstext.',
    });
    await updateReport(group, 'p-1', report.id, { version: 1, body: 'Korrigiert.' });

    const deleted = await resetClassData(teacher, 'RESET');
    expect(deleted.vitals).toBe(2);
    expect(deleted.reports).toBe(1);
    expect(deleted.revisions).toBe(1);
    expect(deleted.audit).toBeGreaterThanOrEqual(4);

    expect(await db.select().from(vitalDailyRecords)).toHaveLength(0);
    expect(await db.select().from(careReports)).toHaveLength(0);
    expect(await db.select().from(careReportRevisions)).toHaveLength(0);
    expect(await db.select().from(auditLog)).toHaveLength(0);
  });

  it('keeps patients, groups, code hashes and the policy', async () => {
    const patientsRows = await db.select().from(patients);
    expect(patientsRows).toHaveLength(1);

    const groups = await db.select().from(studentGroups);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.accessCodeHash).not.toBe('');

    const requirements = await db.select().from(measurementRequirements);
    expect(requirements).toEqual([
      expect.objectContaining({ patientId: 'p-1', field: 'glucose', isExpected: 1 }),
    ]);
  });

  it('refuses a wrong confirmation and a group actor', async () => {
    await expectStatus(resetClassData(teacher, 'reset'), 400);
    await expectStatus(resetClassData(group, 'RESET'), 403);
  });
});
