import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { patients, studentGroups } from '@/db/schema';
import { seedDatabase } from '@/db/seed';
import { createTestDatabase, type TestDatabase } from '../helpers/database';

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
});

afterAll(async () => {
  await testDb.dispose();
});

async function counts() {
  const [patientCount] = await testDb.db.select({ value: sql<number>`count(*)` }).from(patients);
  const [groupCount] = await testDb.db.select({ value: sql<number>`count(*)` }).from(studentGroups);
  return { patients: patientCount?.value ?? 0, groups: groupCount?.value ?? 0 };
}

describe('idempotent seed', () => {
  it('creates exactly ten patients and no groups', async () => {
    const first = await seedDatabase(testDb.db);
    expect(first.createdPatients).toBe(10);
    expect(await counts()).toEqual({ patients: 10, groups: 0 });
  });

  it('changes nothing on a second run and keeps identifiers stable', async () => {
    const before = await testDb.db.select().from(patients).orderBy(patients.id);

    const second = await seedDatabase(testDb.db);
    expect(second.createdPatients).toBe(0);
    expect(await counts()).toEqual({ patients: 10, groups: 0 });

    const after = await testDb.db.select().from(patients).orderBy(patients.id);
    expect(after).toEqual(before);
  });

  it('starts every patient without a date of birth', async () => {
    const rows = await testDb.db.select().from(patients);
    expect(rows.every((row) => row.dateOfBirth === null)).toBe(true);
  });

  it('does not overwrite a name the teacher changed', async () => {
    const [first] = await testDb.db.select().from(patients).orderBy(patients.id).limit(1);
    if (!first) throw new Error('Kein Patient vorhanden.');
    await testDb.db
      .update(patients)
      .set({ displayName: 'Herr Berger', dateOfBirth: '1948-03-07' })
      .where(eq(patients.id, first.id));

    await seedDatabase(testDb.db);

    const rows = await testDb.db.select().from(patients).where(eq(patients.id, first.id));
    expect(rows[0]?.displayName).toBe('Herr Berger');
    expect(rows[0]?.dateOfBirth).toBe('1948-03-07');
  });
});
