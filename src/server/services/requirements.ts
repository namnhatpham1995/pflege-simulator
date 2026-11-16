import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { auditLog, measurementRequirements, patients } from '@/db/schema';
import { HttpError, validationErrorFromZod } from '@/lib/api-error';
import {
  DEFAULT_EXPECTED_FIELDS,
  VITAL_FIELDS,
  type Actor,
  type Requirements,
  type VitalField,
} from '@/lib/types';

export const requirementUpdateSchema = z.strictObject({
  field: z.enum([
    'systolic',
    'diastolic',
    'pulse',
    'temperature',
    'weight',
    'height',
    'pain',
    'glucose',
  ]),
  expected: z.boolean(),
});

export type RequirementUpdate = z.infer<typeof requirementUpdateSchema>;

export async function getRequirementPolicy(patientId: string): Promise<Requirements> {
  const rows = await db
    .select()
    .from(measurementRequirements)
    .where(eq(measurementRequirements.patientId, patientId));

  // A stored row overrides only its own field; the defaults stay for the rest.
  const policy = Object.fromEntries(
    VITAL_FIELDS.map((field) => [field, DEFAULT_EXPECTED_FIELDS.includes(field)]),
  ) as Requirements;
  for (const row of rows) policy[row.field] = row.isExpected === 1;
  return policy;
}

export async function updateRequirementPolicy(
  actor: Actor,
  patientId: string,
  input: unknown,
): Promise<Requirements> {
  if (actor.type !== 'teacher') {
    throw HttpError.forbidden('Nur die Lehrkraft darf Erwartungen setzen.');
  }

  const parsed = requirementUpdateSchema.safeParse(input);
  if (!parsed.success) throw validationErrorFromZod(parsed.error);

  const patientRows = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  if (!patientRows[0]) throw HttpError.notFound('Patient nicht gefunden.');

  const { field, expected } = parsed.data;
  const previous = await getRequirementPolicy(patientId);

  await db
    .insert(measurementRequirements)
    .values({ patientId, field, isExpected: expected ? 1 : 0 })
    .onConflictDoUpdate({
      target: [measurementRequirements.patientId, measurementRequirements.field],
      set: { isExpected: expected ? 1 : 0 },
    });

  await db.insert(auditLog).values({
    id: randomUUID(),
    actorType: actor.type,
    actorId: actor.id,
    patientId,
    entityType: 'measurement_requirement',
    entityId: `${patientId}:${field}`,
    action: 'update',
    changes: JSON.stringify([{ field, from: previous[field], to: expected }]),
    occurredAt: new Date().toISOString(),
  });

  return getRequirementPolicy(patientId);
}
