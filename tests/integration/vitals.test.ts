import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { auditLog, patients, studentGroups } from '@/db/schema';
import { HttpError } from '@/lib/api-error';
import type { Actor } from '@/lib/types';
import {
  getVitalsDay,
  getVitalsRange,
  saveVitalsDay,
} from '@/server/services/vitals';
import { appDatabase } from '../helpers/database';
import type { Database } from '@/db/client';

let db: Database;

const groupA: Actor = { type: 'group', id: 'g-1', displayName: 'Gruppe 1', patientId: 'p-1' };
const groupB: Actor = { type: 'group', id: 'g-2', displayName: 'Gruppe 2', patientId: 'p-2' };
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
});

beforeEach(async () => {
  await db.delete(auditLog);
});

afterAll(async () => {
  const { closeDatabase } = await import('@/db/client');
  await closeDatabase();
});

describe('saveVitalsDay', () => {
  it('creates a day on version 0 and writes one audit row', async () => {
    const saved = await saveVitalsDay(groupA, 'p-1', '2026-11-10', {
      version: 0,
      values: { systolic: 120, diastolic: 80, pulse: 72, pain: 0 },
    });

    expect(saved.version).toBe(1);
    expect(saved.record.date).toBe('2026-11-10');
    expect(saved.record.systolicMmhg).toBe(120);
    expect(saved.record.painScore).toBe(0);
    expect(await auditCount()).toBe(1);

    const rows = await db.select().from(auditLog);
    expect(rows[0]?.action).toBe('create');
    expect(JSON.parse(rows[0]!.changes).map((change: { field: string }) => change.field)).toContain('systolic');
  });

  it('keeps pain 0 distinguishable from empty after a reload', async () => {
    await saveVitalsDay(groupA, 'p-1', '2026-11-11', { version: 0, values: { pain: 0 } });
    const record = await getVitalsDay('p-1', '2026-11-11');
    expect(record?.painScore).toBe(0);
  });

  it('merges omitted keys and clears an explicit null', async () => {
    const created = await saveVitalsDay(groupA, 'p-1', '2026-11-12', {
      version: 0,
      values: { systolic: 130, diastolic: 85, pulse: 70, temperature: 37.1 },
    });

    const updated = await saveVitalsDay(groupA, 'p-1', '2026-11-12', {
      version: created.version,
      values: { temperature: null, pulse: 74 },
    });

    expect(updated.version).toBe(2);
    expect(updated.record.temperatureC).toBeNull();
    expect(updated.record.pulseBpm).toBe(74);
    expect(updated.record.systolicMmhg).toBe(130);
    expect(updated.record.diastolicMmhg).toBe(85);
  });

  it('validates the cross-field rule against stored values, not the patch', async () => {
    await saveVitalsDay(groupA, 'p-1', '2026-11-13', {
      version: 0,
      values: { systolic: 120 },
    });
    await expectStatus(
      saveVitalsDay(groupA, 'p-1', '2026-11-13', { version: 1, values: { diastolic: 130 } }),
      400,
    );
  });

  it('refuses a stale version with the current record and writes no audit row', async () => {
    await saveVitalsDay(groupA, 'p-1', '2026-11-14', { version: 0, values: { pulse: 60 } });
    const before = await auditCount();

    const error = await expectStatus(
      saveVitalsDay(groupA, 'p-1', '2026-11-14', { version: 0, values: { pulse: 61 } }),
      409,
    );
    const current = error.extra?.current as { record: { pulseBpm: number }; version: number };
    expect(current.record.pulseBpm).toBe(60);
    expect(current.version).toBe(1);
    expect(await auditCount()).toBe(before);
  });

  it('lets exactly one of two concurrent first inserts win', async () => {
    const results = await Promise.allSettled([
      saveVitalsDay(groupA, 'p-1', '2026-11-15', { version: 0, values: { pulse: 65 } }),
      saveVitalsDay(groupA, 'p-1', '2026-11-15', { version: 0, values: { pulse: 66 } }),
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(((rejected[0] as PromiseRejectedResult).reason as HttpError).status).toBe(409);
  });

  it('keeps a cleared record rather than deleting the day', async () => {
    const created = await saveVitalsDay(groupA, 'p-1', '2026-11-16', {
      version: 0,
      values: { pain: 4 },
    });
    const cleared = await saveVitalsDay(groupA, 'p-1', '2026-11-16', {
      version: created.version,
      values: { pain: null },
    });
    expect(cleared.record.painScore).toBeNull();
    expect(cleared.version).toBe(2);
    expect(await getVitalsDay('p-1', '2026-11-16')).not.toBeNull();
  });

  it('refuses writes from another group and from the teacher', async () => {
    await expectStatus(
      saveVitalsDay(groupB, 'p-1', '2026-11-17', { version: 0, values: { pulse: 70 } }),
      403,
    );
    await expectStatus(
      saveVitalsDay(teacher, 'p-1', '2026-11-17', { version: 0, values: { pulse: 70 } }),
      403,
    );
  });

  it('rejects an invalid date and an invalid body', async () => {
    await expectStatus(
      saveVitalsDay(groupA, 'p-1', '2027-02-29', { version: 0, values: {} }),
      400,
    );
    await expectStatus(
      saveVitalsDay(groupA, 'p-1', '2026-11-18', { version: 0, values: { pulse: 70 }, shift: 'frueh' }),
      400,
    );
  });
});

describe('getVitalsRange', () => {
  it('returns inclusive records in ascending order with requirements', async () => {
    await saveVitalsDay(groupB, 'p-2', '2026-10-01', { version: 0, values: { pulse: 70 } });
    await saveVitalsDay(groupB, 'p-2', '2026-10-03', { version: 0, values: { pulse: 71 } });

    const { records, requirements } = await getVitalsRange('p-2', '2026-10-01', '2026-10-03');
    expect(records.map((record) => record.date)).toEqual(['2026-10-01', '2026-10-03']);
    expect(requirements).toMatchObject({ systolic: true, diastolic: true, pulse: true });
    expect(requirements.temperature).toBe(false);
  });

  it('rejects a reversed range and an over-long range', async () => {
    await expectStatus(getVitalsRange('p-2', '2026-10-05', '2026-10-01'), 400);
    await expectStatus(getVitalsRange('p-2', '2026-10-01', '2026-11-02'), 400);
  });

  it('accepts a full 31-day window', async () => {
    const result = await getVitalsRange('p-2', '2026-10-01', '2026-10-31');
    expect(Array.isArray(result.records)).toBe(true);
  });
});
