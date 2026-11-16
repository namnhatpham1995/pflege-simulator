import { randomUUID } from 'node:crypto';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  auditLog,
  measurementRequirements,
  vitalDailyRecords,
  type VitalDailyRecordRow,
} from '@/db/schema';
import { HttpError, validationErrorFromZod } from '@/lib/api-error';
import { compareDates, isValidCalendarDate } from '@/lib/date';
import {
  DEFAULT_EXPECTED_FIELDS,
  VITAL_FIELDS,
  type Actor,
  type Requirements,
  type VitalRecord,
} from '@/lib/types';
import {
  changedFields,
  columnsFromValues,
  emptyValues,
  mergeValues,
  valuesFromRecord,
} from '@/lib/vitals';
import { crossFieldErrors, vitalsPatchSchema } from '@/lib/validation/vitals';
import { serialiseWrites } from '@/server/write-queue';

export const MAX_RANGE_DAYS = 31;

export interface SavedVitals {
  record: VitalRecord;
  version: number;
}

function assertDate(value: string, field = 'date'): void {
  if (!isValidCalendarDate(value)) {
    throw HttpError.validation({ [field]: 'Bitte ein gültiges Datum im Format JJJJ-MM-TT angeben.' });
  }
}

function dayDifference(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.round((b - a) / 86_400_000);
}

function toRecord(row: VitalDailyRecordRow): VitalRecord {
  return row;
}

function conflictWithCurrent(current: VitalRecord | null): HttpError {
  return new HttpError(409, 'CONFLICT', 'Der Tag wurde zwischenzeitlich geändert.', {
    extra: { current: current ? { record: current, version: current.version } : null },
  });
}

function isUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unique constraint failed|sqlite_constraint/i.test(message);
}


export async function getRequirements(patientId: string): Promise<Requirements> {
  const rows = await db
    .select()
    .from(measurementRequirements)
    .where(eq(measurementRequirements.patientId, patientId));

  // Per-field defaults, overridden only where the teacher stored a decision.
  const requirements = Object.fromEntries(
    VITAL_FIELDS.map((field) => [field, DEFAULT_EXPECTED_FIELDS.includes(field)]),
  ) as Requirements;
  for (const row of rows) requirements[row.field] = row.isExpected === 1;
  return requirements;
}

export async function getVitalsRange(
  patientId: string,
  from: string,
  to: string,
): Promise<{ records: VitalRecord[]; requirements: Requirements }> {
  assertDate(from, 'from');
  assertDate(to, 'to');
  if (compareDates(from, to) > 0) {
    throw HttpError.validation({ from: 'Das Startdatum liegt nach dem Enddatum.' });
  }
  if (dayDifference(from, to) > MAX_RANGE_DAYS - 1) {
    throw HttpError.validation({
      to: `Der Zeitraum ist auf ${MAX_RANGE_DAYS} Tage begrenzt.`,
    });
  }

  const [records, requirements] = await Promise.all([
    db
      .select()
      .from(vitalDailyRecords)
      .where(
        and(
          eq(vitalDailyRecords.patientId, patientId),
          gte(vitalDailyRecords.date, from),
          lte(vitalDailyRecords.date, to),
        ),
      )
      .orderBy(asc(vitalDailyRecords.date)),
    getRequirements(patientId),
  ]);

  return { records: records.map(toRecord), requirements };
}

export async function getVitalsDay(patientId: string, date: string): Promise<VitalRecord | null> {
  assertDate(date);
  const rows = await db
    .select()
    .from(vitalDailyRecords)
    .where(and(eq(vitalDailyRecords.patientId, patientId), eq(vitalDailyRecords.date, date)))
    .limit(1);
  return rows[0] ? toRecord(rows[0]) : null;
}

/**
 * One transaction: read, version check, merge, cross-field validation, write and
 * audit. Omitted keys stay unchanged; explicit nulls clear a value.
 */
export async function saveVitalsDay(
  actor: Actor,
  patientId: string,
  date: string,
  input: unknown,
): Promise<SavedVitals> {
  assertDate(date);
  if (actor.type !== 'group' || actor.patientId !== patientId) {
    throw HttpError.forbidden('Nur die zugeordnete Gruppe darf Werte erfassen.');
  }

  const parsed = vitalsPatchSchema.safeParse(input);
  if (!parsed.success) throw validationErrorFromZod(parsed.error);
  const patch = parsed.data;
  const now = new Date().toISOString();

  try {
    return await serialiseWrites(() =>
      db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(vitalDailyRecords)
        .where(and(eq(vitalDailyRecords.patientId, patientId), eq(vitalDailyRecords.date, date)))
        .limit(1);
      const existing = rows[0] ?? null;

      if (!existing) {
        if (patch.version !== 0) throw conflictWithCurrent(null);

        const values = mergeValues(emptyValues(), patch.values);
        const errors = crossFieldErrors(values);
        if (Object.keys(errors).length > 0) throw HttpError.validation(errors);

        const inserted = await tx
          .insert(vitalDailyRecords)
          .values({
            id: randomUUID(),
            patientId,
            date,
            ...columnsFromValues(values),
            version: 1,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        const record = toRecord(inserted[0]!);
        await tx.insert(auditLog).values({
          id: randomUUID(),
          actorType: actor.type,
          actorId: actor.id,
          patientId,
          entityType: 'vital_daily_record',
          entityId: record.id,
          action: 'create',
          changes: JSON.stringify(changedFields(emptyValues(), values)),
          occurredAt: now,
        });
        return { record, version: record.version };
      }

      if (patch.version !== existing.version) throw conflictWithCurrent(toRecord(existing));

      const before = valuesFromRecord(toRecord(existing));
      const after = mergeValues(before, patch.values);
      const errors = crossFieldErrors(after);
      if (Object.keys(errors).length > 0) throw HttpError.validation(errors);

      const changes = changedFields(before, after);
      if (changes.length === 0) return { record: toRecord(existing), version: existing.version };

      const updated = await tx
        .update(vitalDailyRecords)
        .set({
          ...columnsFromValues(after),
          version: existing.version + 1,
          updatedAt: now,
        })
        .where(
          and(
            eq(vitalDailyRecords.id, existing.id),
            eq(vitalDailyRecords.version, existing.version),
          ),
        )
        .returning();

      if (!updated[0]) throw conflictWithCurrent(toRecord(existing));

      const record = toRecord(updated[0]);
      await tx.insert(auditLog).values({
        id: randomUUID(),
        actorType: actor.type,
        actorId: actor.id,
        patientId,
        entityType: 'vital_daily_record',
        entityId: record.id,
        action: 'update',
        changes: JSON.stringify(changes),
        occurredAt: now,
      });

        return { record, version: record.version };
      }),
    );
  } catch (error) {
    // A concurrent first insert can win the unique(patient_id, date) race; the
    // transaction is rolled back, so re-read through the outer connection.
    if (isUniqueViolation(error)) {
      const current = await getVitalsDay(patientId, date);
      throw conflictWithCurrent(current);
    }
    throw error;
  }
}
