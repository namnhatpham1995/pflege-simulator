import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { measurementRequirements, patients, studentGroups } from '@/db/schema';
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
  const [requirementCount] = await testDb.db
    .select({ value: sql<number>`count(*)` })
    .from(measurementRequirements);
  return {
    patients: patientCount?.value ?? 0,
    groups: groupCount?.value ?? 0,
    requirements: requirementCount?.value ?? 0,
  };
}

describe('idempotent seed', () => {
  it('creates exactly ten patients, ten groups and eight requirements each', async () => {
    const first = await seedDatabase(testDb.db, { writeCodeFile: false });
    expect(first.createdGroups).toBe(10);
    expect(await counts()).toEqual({ patients: 10, groups: 10, requirements: 80 });
  });

  it('keeps identifiers and access-code hashes stable on a second run', async () => {
    const before = await testDb.db
      .select({
        id: studentGroups.id,
        hash: studentGroups.accessCodeHash,
        patientId: studentGroups.patientId,
      })
      .from(studentGroups);

    const second = await seedDatabase(testDb.db, { writeCodeFile: false });
    expect(second.createdGroups).toBe(0);
    expect(second.codes).toHaveLength(0);
    expect(await counts()).toEqual({ patients: 10, groups: 10, requirements: 80 });

    const after = await testDb.db
      .select({
        id: studentGroups.id,
        hash: studentGroups.accessCodeHash,
        patientId: studentGroups.patientId,
      })
      .from(studentGroups);

    expect(after).toEqual(before);
  });

  it('gives every group its own patient and a distinct hash', async () => {
    const rows = await testDb.db.select().from(studentGroups);
    expect(new Set(rows.map((row) => row.patientId)).size).toBe(10);
    expect(new Set(rows.map((row) => row.accessCodeHash)).size).toBe(10);
    for (const row of rows) {
      expect(row.accessCodeHash.startsWith('scrypt$')).toBe(true);
    }
  });

  it('marks systolic, diastolic and pulse expected and the other five optional', async () => {
    const rows = await testDb.db.select().from(measurementRequirements);
    const expectedFields = new Set(
      rows.filter((row) => row.isExpected === 1).map((row) => row.field),
    );
    expect([...expectedFields].sort()).toEqual(['diastolic', 'pulse', 'systolic']);
  });
});
