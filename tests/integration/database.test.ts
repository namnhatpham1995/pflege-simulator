import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { patients, vitalDailyRecords } from '@/db/schema';
import { createTestDatabase, type TestDatabase } from '../helpers/database';

let testDb: TestDatabase;
const patientId = 'patient-a';
const now = '2026-11-16T08:00:00.000Z';

function insertVitals(date: string, painScore: number | null) {
  return testDb.db.insert(vitalDailyRecords).values({
    id: `vitals-${date}`,
    patientId,
    date,
    painScore,
    createdAt: now,
    updatedAt: now,
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
    await insertVitals('2026-11-10', 3);
    const rows = await testDb.db
      .select()
      .from(vitalDailyRecords)
      .where(eq(vitalDailyRecords.date, '2026-11-10'));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.patientId).toBe(patientId);
    expect(rows[0]?.painScore).toBe(3);
    expect(rows[0]?.version).toBe(1);
  });

  it('stores pain 0 as zero, not as missing', async () => {
    await insertVitals('2026-11-11', 0);
    const rows = await testDb.db
      .select()
      .from(vitalDailyRecords)
      .where(eq(vitalDailyRecords.date, '2026-11-11'));
    expect(rows[0]?.painScore).toBe(0);
  });

  it('rejects a second record for the same patient and day', async () => {
    await expect(insertVitals('2026-11-10', 4)).rejects.toThrow();
  });

  it('rejects a pain score above 10 at the database level', async () => {
    await expect(insertVitals('2026-11-12', 11)).rejects.toThrow();
  });

  it('rejects a record for an unknown patient through the foreign key', async () => {
    await expect(
      testDb.db.insert(vitalDailyRecords).values({
        id: 'vitals-orphan',
        patientId: 'does-not-exist',
        date: '2026-11-13',
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow();
  });
});
