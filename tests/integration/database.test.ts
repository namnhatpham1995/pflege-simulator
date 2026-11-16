import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { patients, vitalDailyRecords, vitalEntries } from '@/db/schema';
import { createTestDatabase, type TestDatabase } from '../helpers/database';

let testDb: TestDatabase;
const patientId = 'patient-a';
const now = '2026-11-16T08:00:00.000Z';

function insertEntry(overrides: Partial<typeof vitalEntries.$inferInsert> = {}) {
  return testDb.db.insert(vitalEntries).values({
    id: `entry-${Math.random().toString(36).slice(2)}`,
    patientId,
    kind: 'pulse',
    value: 72,
    observedDate: '2026-11-12',
    observedTime: '09:15',
    submissionId: 'submission-1',
    createdAt: now,
    ...overrides,
  });
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.db.insert(patients).values({
    id: patientId,
    displayName: 'Frau Albrecht',
    createdAt: now,
  });
});

afterAll(async () => {
  await testDb.dispose();
});

describe('schema invariants', () => {
  it('round-trips a patient and its vital record through the libSQL file', async () => {
    await testDb.db.insert(vitalDailyRecords).values({
      id: 'vitals-2026-11-10',
      patientId,
      date: '2026-11-10',
      painScore: 3,
      createdAt: now,
      updatedAt: now,
    });

    const rows = await testDb.db
      .select()
      .from(vitalDailyRecords)
      .where(eq(vitalDailyRecords.date, '2026-11-10'));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.patientId).toBe(patientId);
    expect(rows[0]?.painScore).toBe(3);
  });

  it('stores a nullable date of birth on the patient', async () => {
    await testDb.db
      .update(patients)
      .set({ dateOfBirth: '1948-03-07' })
      .where(eq(patients.id, patientId));
    const rows = await testDb.db.select().from(patients).where(eq(patients.id, patientId));
    expect(rows[0]?.dateOfBirth).toBe('1948-03-07');
  });

  it('rejects an unknown kind through the CHECK constraint', async () => {
    await expect(
      insertEntry({ kind: 'spo2' as typeof vitalEntries.$inferInsert.kind }),
    ).rejects.toThrow();
  });

  it('refuses a NULL value', async () => {
    await expect(
      insertEntry({ value: null as unknown as number }),
    ).rejects.toThrow();
  });

  it('accepts two entries with the same patient, kind, date and time', async () => {
    await insertEntry({ id: 'duplicate-a' });
    await insertEntry({ id: 'duplicate-b', value: 74, submissionId: 'submission-2' });

    const rows = await testDb.db
      .select()
      .from(vitalEntries)
      .where(eq(vitalEntries.patientId, patientId));
    expect(rows.filter((row) => row.kind === 'pulse')).toHaveLength(2);
  });

  it('keeps the legacy tables in place for the previous release', async () => {
    const result = await testDb.client.execute(
      "select name from sqlite_master where type = 'table'",
    );
    const names = result.rows.map((row) => String(row.name));
    expect(names).toContain('vital_daily_records');
    expect(names).toContain('measurement_requirements');
    expect(names).toContain('student_groups');
    expect(names).toContain('vital_entries');
  });
});
