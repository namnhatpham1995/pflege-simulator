import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditLog, measurementRequirements, patients, studentGroups } from '@/db/schema';
import { HttpError } from '@/lib/api-error';
import type { Actor } from '@/lib/types';
import { getRequirementPolicy, updateRequirementPolicy } from '@/server/services/requirements';
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
  await db.insert(patients).values([
    { id: 'p-1', displayName: 'Frau Albrecht', createdAt: now },
    { id: 'p-2', displayName: 'Herr Brandt', createdAt: now },
  ]);
  await db.insert(studentGroups).values([
    { id: 'g-1', displayName: 'Gruppe 1', patientId: 'p-1', accessCodeHash: 'scrypt$1$1$1$00$00', isActive: 1 },
  ]);
});

afterAll(async () => {
  const { closeDatabase } = await import('@/db/client');
  await closeDatabase();
});

describe('requirement policy', () => {
  it('defaults to blood pressure and pulse expected', async () => {
    const policy = await getRequirementPolicy('p-1');
    expect(policy).toEqual({
      systolic: true,
      diastolic: true,
      pulse: true,
      temperature: false,
      weight: false,
      height: false,
      pain: false,
      glucose: false,
    });
  });

  it('marks an optional field expected without touching the others', async () => {
    const policy = await updateRequirementPolicy(teacher, 'p-1', {
      field: 'temperature',
      expected: true,
    });
    expect(policy.temperature).toBe(true);
    expect(policy.systolic).toBe(true);

    const again = await updateRequirementPolicy(teacher, 'p-1', {
      field: 'temperature',
      expected: false,
    });
    expect(again.temperature).toBe(false);
  });

  it('can remove an expected field and persists one row per field', async () => {
    await updateRequirementPolicy(teacher, 'p-1', { field: 'systolic', expected: false });
    const policy = await getRequirementPolicy('p-1');
    expect(policy.systolic).toBe(false);

    const rows = await db.select().from(measurementRequirements);
    expect(rows).toHaveLength(2);
  });

  it('scopes the policy to the patient', async () => {
    const other = await getRequirementPolicy('p-2');
    expect(other.systolic).toBe(true);

    await updateRequirementPolicy(teacher, 'p-2', { field: 'pain', expected: true });
    expect((await getRequirementPolicy('p-1')).pain).toBe(false);
    expect((await getRequirementPolicy('p-2')).pain).toBe(true);
  });

  it('writes one audit row per accepted change', async () => {
    const before = await db.select().from(auditLog);
    await updateRequirementPolicy(teacher, 'p-1', { field: 'glucose', expected: true });
    const after = await db.select().from(auditLog);

    expect(after.length).toBe(before.length + 1);
    const row = after.at(-1)!;
    expect(row.entityType).toBe('measurement_requirement');
    expect(row.actorType).toBe('teacher');
    expect(JSON.parse(row.changes)).toEqual([{ field: 'glucose', from: false, to: true }]);
  });

  it('refuses a group, an unknown field and an unknown patient', async () => {
    await expectStatus(
      updateRequirementPolicy(group, 'p-1', { field: 'pulse', expected: false }),
      403,
    );
    await expectStatus(
      updateRequirementPolicy(teacher, 'p-1', { field: 'spo2', expected: true }),
      400,
    );
    await expectStatus(
      updateRequirementPolicy(teacher, 'p-404', { field: 'pulse', expected: true }),
      404,
    );
  });
});
