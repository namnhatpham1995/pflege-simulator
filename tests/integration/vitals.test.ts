import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { auditLog, patients, vitalEntries } from '@/db/schema';
import { HttpError } from '@/lib/api-error';
import type { Actor } from '@/lib/types';
import { anonymousActor } from '@/server/services/access';
import {
  createEntries,
  deleteEntries,
  getEntriesRange,
  listRecentEntries,
} from '@/server/services/vitals';
import { appDatabase } from '../helpers/database';
import type { Database } from '@/db/client';

let db: Database;

const student = anonymousActor('p-1');
const teacher: Actor = { type: 'teacher', id: 'teacher', displayName: 'Lehrkraft' };

async function auditCount(): Promise<number> {
  const [row] = await db.select({ value: sql<number>`count(*)` }).from(auditLog);
  return row?.value ?? 0;
}

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

function input(
  category: string,
  values: Record<string, string | number>,
  date = '2026-11-12',
  time = '09:15',
) {
  return { category, values, date, time };
}

beforeAll(async () => {
  db = await appDatabase();
  const now = new Date().toISOString();
  await db.insert(patients).values([
    { id: 'p-1', displayName: 'Frau Albrecht', createdAt: now },
    { id: 'p-2', displayName: 'Herr Brandt', createdAt: now },
    { id: 'p-3', displayName: 'Frau Czerwenka', createdAt: now },
  ]);
});

beforeEach(async () => {
  await db.delete(auditLog);
  await db.delete(vitalEntries);
});

afterAll(async () => {
  const { closeDatabase } = await import('@/db/client');
  await closeDatabase();
});

describe('createEntries', () => {
  it('stores a single value and writes one audit row', async () => {
    const created = await createEntries(student, 'p-1', input('puls', { pulse: 82 }));
    expect(created.entries).toHaveLength(1);
    expect(created.entries[0]).toMatchObject({
      patientId: 'p-1',
      kind: 'pulse',
      value: 82,
      observedDate: '2026-11-12',
      observedTime: '09:15',
    });
    expect(created.groups[0]?.values).toEqual({ pulse: 82 });
    expect(await auditCount()).toBe(1);

    const rows = await db.select().from(auditLog);
    expect(rows[0]?.action).toBe('create');
    expect(rows[0]?.actorId).toBe('patient:p-1');
    expect(rows[0]?.changes).toContain('"field":"pulse"');
    expect(rows[0]?.changes).toContain('"to":82');
  });

  it('stores pain 0 as a recorded value', async () => {
    const created = await createEntries(student, 'p-1', input('schmerzen', { pain: 0 }));
    expect(created.entries[0]?.value).toBe(0);
    const recent = await listRecentEntries('p-1');
    expect(recent.schmerzen[0]?.values).toEqual({ pain: 0 });
  });

  it('stores a blood pressure pair with one submission and one audit row', async () => {
    const created = await createEntries(
      student,
      'p-1',
      input('blutdruck', { systolic: 120, diastolic: 80 }, '2026-11-13', '08:00'),
    );

    expect(created.entries).toHaveLength(2);
    const [systolic, diastolic] = created.entries;
    expect(systolic?.kind).toBe('systolic');
    expect(diastolic?.kind).toBe('diastolic');
    expect(systolic?.submissionId).toBe(diastolic?.submissionId);
    expect(systolic?.observedTime).toBe('08:00');
    expect(await auditCount()).toBe(1);
    expect(created.groups[0]?.values).toEqual({ systolic: 120, diastolic: 80 });
  });

  it('accepts two entries at the same minute', async () => {
    await createEntries(student, 'p-1', input('puls', { pulse: 80 }));
    await createEntries(student, 'p-1', input('puls', { pulse: 84 }));

    const rows = await db.select().from(vitalEntries);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.submissionId)).size).toBe(2);
  });

  it('lets two concurrent saves both succeed', async () => {
    const results = await Promise.all([
      createEntries(student, 'p-1', input('puls', { pulse: 70 })),
      createEntries(student, 'p-1', input('puls', { pulse: 72 })),
    ]);
    expect(results.every((result) => result.entries.length === 1)).toBe(true);
    expect(await db.select().from(vitalEntries)).toHaveLength(2);
  });

  it('writes neither blood-pressure row when one value is invalid', async () => {
    await expectStatus(
      createEntries(student, 'p-1', input('blutdruck', { systolic: 120, diastolic: 900 })),
      400,
    );
    expect(await db.select().from(vitalEntries)).toHaveLength(0);
    expect(await auditCount()).toBe(0);
  });

  it('refuses a missing pair value, an unknown field and a shift', async () => {
    await expectStatus(createEntries(student, 'p-1', input('blutdruck', { systolic: 120 })), 400);
    await expectStatus(createEntries(student, 'p-1', input('puls', { pulse: 70, spo2: 98 })), 400);
    await expectStatus(
      createEntries(student, 'p-1', { ...input('puls', { pulse: 70 }), shift: 'frueh' }),
      400,
    );
  });

  it('refuses the teacher with 403 and writes nothing', async () => {
    await expectStatus(createEntries(teacher, 'p-1', input('puls', { pulse: 70 })), 403);
    expect(await db.select().from(vitalEntries)).toHaveLength(0);
  });
});

describe('deleteEntries', () => {
  it('deletes a blood pressure pair as one unit and audits the deletion', async () => {
    const created = await createEntries(
      student,
      'p-1',
      input('blutdruck', { systolic: 130, diastolic: 85 }, '2026-11-14', '10:30'),
    );
    const submissionId = created.entries[0]!.submissionId;

    const result = await deleteEntries(student, 'p-1', submissionId);
    expect(result.deleted).toBe(2);
    expect(await db.select().from(vitalEntries)).toHaveLength(0);

    const rows = await db.select().from(auditLog);
    const deletion = rows.find((row) => row.action === 'delete');
    expect(deletion?.changes).toContain('"field":"systolic"');
    expect(deletion?.changes).toContain('"from":130');
  });

  it('returns 404 on a second delete and changes nothing', async () => {
    const created = await createEntries(student, 'p-1', input('puls', { pulse: 68 }));
    const submissionId = created.entries[0]!.submissionId;
    await deleteEntries(student, 'p-1', submissionId);
    await expectStatus(deleteEntries(student, 'p-1', submissionId), 404);
  });

  it('refuses the teacher with 403', async () => {
    const created = await createEntries(student, 'p-1', input('puls', { pulse: 68 }));
    await expectStatus(
      deleteEntries(teacher, 'p-1', created.entries[0]!.submissionId),
      403,
    );
    expect(await db.select().from(vitalEntries)).toHaveLength(1);
  });
});

describe('getEntriesRange', () => {
  it('returns an inclusive range ordered by date, time and creation', async () => {
    await createEntries(student, 'p-2', input('puls', { pulse: 90 }, '2026-10-03', '09:00'));
    await createEntries(student, 'p-2', input('puls', { pulse: 70 }, '2026-10-01', '09:00'));
    await createEntries(student, 'p-2', input('puls', { pulse: 80 }, '2026-10-01', '11:00'));

    const entries = await getEntriesRange('p-2', '2026-10-01', '2026-10-03');
    expect(entries.map((entry) => `${entry.observedDate} ${entry.observedTime}`)).toEqual([
      '2026-10-01 09:00',
      '2026-10-01 11:00',
      '2026-10-03 09:00',
    ]);
  });

  it('keeps creation order for equal times', async () => {
    const base = {
      patientId: 'p-2',
      kind: 'pulse' as const,
      value: 70,
      observedDate: '2026-10-05',
      observedTime: '09:00',
    };
    await db.insert(vitalEntries).values([
      { ...base, id: 'third', submissionId: 's3', createdAt: '2026-10-05T10:00:03.000Z' },
      { ...base, id: 'first', submissionId: 's1', createdAt: '2026-10-05T10:00:01.000Z' },
      { ...base, id: 'second', submissionId: 's2', createdAt: '2026-10-05T10:00:02.000Z' },
    ]);

    const entries = await getEntriesRange('p-2', '2026-10-05', '2026-10-05');
    expect(entries.map((entry) => entry.id)).toEqual(['first', 'second', 'third']);
  });

  it('rejects a reversed range and an over-long range', async () => {
    await expectStatus(getEntriesRange('p-2', '2026-10-05', '2026-10-01'), 400);
    await expectStatus(getEntriesRange('p-2', '2026-10-01', '2026-11-02'), 400);
  });

  it('accepts a full 31-day window', async () => {
    await expect(getEntriesRange('p-2', '2026-10-01', '2026-10-31')).resolves.toEqual([]);
  });
});

describe('listRecentEntries', () => {
  it('shows a blood-pressure pair once and keeps categories apart', async () => {
    await createEntries(student, 'p-1', input('blutdruck', { systolic: 120, diastolic: 80 }));
    await createEntries(student, 'p-1', input('gewicht', { weight: 74.5 }));

    const recent = await listRecentEntries('p-1');
    expect(recent.blutdruck).toHaveLength(1);
    expect(recent.blutdruck[0]?.values).toEqual({ systolic: 120, diastolic: 80 });
    expect(recent.gewicht).toHaveLength(1);
    expect(recent.puls).toEqual([]);
  });

  it('caps each category at the 50 newest entries', async () => {
    const rows = Array.from({ length: 55 }, (_, index) => ({
      id: randomUUID(),
      patientId: 'p-3',
      kind: 'pulse' as const,
      value: 60 + index,
      observedDate: '2026-10-01',
      observedTime: '09:00',
      submissionId: randomUUID(),
      createdAt: new Date(Date.UTC(2026, 9, 1, 8, 0, index)).toISOString(),
    }));
    await db.insert(vitalEntries).values(rows);

    const recent = await listRecentEntries('p-3');
    expect(recent.puls).toHaveLength(50);
    expect(recent.puls[0]?.values.pulse).toBe(114);
  });
});
