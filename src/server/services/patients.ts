import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { auditLog, patients } from '@/db/schema';
import { HttpError, validationErrorFromZod } from '@/lib/api-error';
import { isValidCalendarDate, todayInBerlin } from '@/lib/date';
import type { Actor, ChangeRecord, PatientSummary } from '@/lib/types';
import { serialiseWrites } from '@/server/write-queue';

export const MAX_PATIENT_NAME = 100;
export const EARLIEST_DATE_OF_BIRTH = '1900-01-01';

/** The patient list is open to every visitor and always holds all ten patients. */
export async function listPatients(): Promise<PatientSummary[]> {
  return db
    .select({
      id: patients.id,
      displayName: patients.displayName,
      dateOfBirth: patients.dateOfBirth,
    })
    .from(patients)
    .orderBy(asc(patients.displayName));
}

export const patientUpdateSchema = z.strictObject({
  displayName: z.string({ required_error: 'Bitte einen Namen eingeben.' }).optional(),
  dateOfBirth: z.string().nullable().optional(),
});

export type PatientUpdateInput = z.infer<typeof patientUpdateSchema>;

async function readPatient(patientId: string): Promise<PatientSummary> {
  const rows = await db
    .select({
      id: patients.id,
      displayName: patients.displayName,
      dateOfBirth: patients.dateOfBirth,
    })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  const patient = rows[0];
  if (!patient) throw HttpError.notFound('Patient nicht gefunden.');
  return patient;
}

/** Teacher-only: change the name and optional date of birth, with an audit row. */
export async function updatePatient(
  actor: Actor,
  patientId: string,
  input: unknown,
): Promise<PatientSummary> {
  if (actor.type !== 'teacher') {
    throw HttpError.forbidden('Nur die Lehrkraft darf Patientendaten ändern.');
  }

  const parsed = patientUpdateSchema.safeParse(input);
  if (!parsed.success) throw validationErrorFromZod(parsed.error);

  const current = await readPatient(patientId);
  const errors: Record<string, string> = {};
  const changes: ChangeRecord[] = [];
  const update: { displayName?: string; dateOfBirth?: string | null } = {};

  if (parsed.data.displayName !== undefined) {
    const name = parsed.data.displayName.trim();
    if (name.length < 1) {
      errors.displayName = 'Bitte einen Namen eingeben.';
    } else if (name.length > MAX_PATIENT_NAME) {
      errors.displayName = `Der Name darf höchstens ${MAX_PATIENT_NAME} Zeichen lang sein.`;
    } else if (name !== current.displayName) {
      update.displayName = name;
      changes.push({ field: 'displayName', from: current.displayName, to: name });
    }
  }

  if (parsed.data.dateOfBirth !== undefined) {
    const dateOfBirth = parsed.data.dateOfBirth;
    if (dateOfBirth === null) {
      if (current.dateOfBirth !== null) {
        update.dateOfBirth = null;
        changes.push({ field: 'dateOfBirth', from: current.dateOfBirth, to: null });
      }
    } else if (!isValidCalendarDate(dateOfBirth)) {
      errors.dateOfBirth = 'Bitte ein gültiges Datum im Format JJJJ-MM-TT angeben.';
    } else if (dateOfBirth < EARLIEST_DATE_OF_BIRTH) {
      errors.dateOfBirth = 'Das Geburtsdatum darf nicht vor dem 01.01.1900 liegen.';
    } else if (dateOfBirth > todayInBerlin()) {
      errors.dateOfBirth = 'Das Geburtsdatum darf nicht in der Zukunft liegen.';
    } else if (dateOfBirth !== current.dateOfBirth) {
      update.dateOfBirth = dateOfBirth;
      changes.push({ field: 'dateOfBirth', from: current.dateOfBirth, to: dateOfBirth });
    }
  }

  if (Object.keys(errors).length > 0) throw HttpError.validation(errors);
  if (changes.length === 0) return current;

  const now = new Date().toISOString();
  return serialiseWrites(() =>
    db.transaction(async (tx) => {
      const updated = await tx
        .update(patients)
        .set(update)
        .where(eq(patients.id, patientId))
        .returning({
          id: patients.id,
          displayName: patients.displayName,
          dateOfBirth: patients.dateOfBirth,
        });

      const patient = updated[0];
      if (!patient) throw HttpError.notFound('Patient nicht gefunden.');

      await tx.insert(auditLog).values({
        id: randomUUID(),
        actorType: actor.type,
        actorId: actor.id,
        patientId,
        entityType: 'patient',
        entityId: patientId,
        action: 'update',
        changes: JSON.stringify(changes),
        occurredAt: now,
      });

      return patient;
    }),
  );
}
