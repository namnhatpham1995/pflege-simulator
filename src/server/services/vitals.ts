import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditLog, vitalEntries, type VitalEntryRow } from '@/db/schema';
import { HttpError, validationErrorFromZod } from '@/lib/api-error';
import { compareDates, dayDifference, isValidCalendarDate } from '@/lib/date';
import {
  categoryDefinition,
  type Actor,
  type EntryGroup,
  type RecentEntries,
  type VitalEntry,
  type VitalField,
} from '@/lib/types';
import { groupEntries, recentByCategory } from '@/lib/vitals';
import { categoryValueErrors, entryCreateSchema } from '@/lib/validation/vitals';
import { assertStudentWrite } from '@/server/services/access';
import { serialiseWrites } from '@/server/write-queue';

export const MAX_RANGE_DAYS = 31;

function toEntry(row: VitalEntryRow): VitalEntry {
  return {
    id: row.id,
    patientId: row.patientId,
    kind: row.kind,
    value: row.value,
    observedDate: row.observedDate,
    observedTime: row.observedTime,
    submissionId: row.submissionId,
    createdAt: row.createdAt,
  };
}

function assertDate(value: string, field = 'date'): void {
  if (!isValidCalendarDate(value)) {
    throw HttpError.validation({ [field]: 'Bitte ein gültiges Datum im Format JJJJ-MM-TT angeben.' });
  }
}

/** Inclusive range, capped at 31 days, ordered by date, time and creation. */
export async function getEntriesRange(
  patientId: string,
  from: string,
  to: string,
): Promise<VitalEntry[]> {
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

  const rows = await db
    .select()
    .from(vitalEntries)
    .where(
      and(
        eq(vitalEntries.patientId, patientId),
        gte(vitalEntries.observedDate, from),
        lte(vitalEntries.observedDate, to),
      ),
    )
    .orderBy(
      asc(vitalEntries.observedDate),
      asc(vitalEntries.observedTime),
      asc(vitalEntries.createdAt),
      asc(vitalEntries.id),
    );

  return rows.map(toEntry);
}

/** Newest 50 per category for the Vitalwerte tab; a blood-pressure pair counts once. */
export async function listRecentEntries(patientId: string): Promise<RecentEntries> {
  const rows = await db
    .select()
    .from(vitalEntries)
    .where(eq(vitalEntries.patientId, patientId))
    .orderBy(
      desc(vitalEntries.observedDate),
      desc(vitalEntries.observedTime),
      desc(vitalEntries.createdAt),
    )
    .limit(2000);

  return recentByCategory(groupEntries(rows.map(toEntry)));
}

export interface CreatedEntries {
  entries: VitalEntry[];
  groups: EntryGroup[];
}

/**
 * One save is one submission: a single value or the two rows of a blood
 * pressure pair, written with its audit row in one transaction.
 */
export async function createEntries(
  actor: Actor,
  patientId: string,
  input: unknown,
): Promise<CreatedEntries> {
  assertStudentWrite(actor);

  const parsed = entryCreateSchema.safeParse(input);
  if (!parsed.success) throw validationErrorFromZod(parsed.error);

  const { category, values, date, time } = parsed.data;
  const errors = categoryValueErrors(category, values);
  if (Object.keys(errors).length > 0) throw HttpError.validation(errors);

  const definition = categoryDefinition(category);
  const submissionId = randomUUID();
  const now = new Date().toISOString();

  const entries = await serialiseWrites(() =>
    db.transaction(async (tx) => {
      const inserted = await tx
        .insert(vitalEntries)
        .values(
          definition.fields.map((kind) => ({
            id: randomUUID(),
            patientId,
            kind: kind as VitalField,
            value: values[kind] as number,
            observedDate: date,
            observedTime: time,
            submissionId,
            createdAt: now,
          })),
        )
        .returning();

      await tx.insert(auditLog).values({
        id: randomUUID(),
        actorType: actor.type,
        actorId: actor.id,
        patientId,
        entityType: 'vital_entry',
        entityId: submissionId,
        action: 'create',
        changes: JSON.stringify(
          inserted.map((row) => ({
            field: row.kind,
            from: null,
            to: row.value,
            date: row.observedDate,
            time: row.observedTime,
          })),
        ),
        occurredAt: now,
      });

      return inserted.map(toEntry);
    }),
  );

  return { entries, groups: groupEntries(entries) };
}

/** Deletes one submission (a pair as a unit) and records what was removed. */
export async function deleteEntries(
  actor: Actor,
  patientId: string,
  submissionId: string,
): Promise<{ deleted: number }> {
  assertStudentWrite(actor);

  return serialiseWrites(() =>
    db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(vitalEntries)
        .where(
          and(
            eq(vitalEntries.patientId, patientId),
            eq(vitalEntries.submissionId, submissionId),
          ),
        );

      if (rows.length === 0) throw HttpError.notFound('Messwert nicht gefunden.');

      await tx
        .delete(vitalEntries)
        .where(
          and(
            eq(vitalEntries.patientId, patientId),
            eq(vitalEntries.submissionId, submissionId),
          ),
        );

      await tx.insert(auditLog).values({
        id: randomUUID(),
        actorType: actor.type,
        actorId: actor.id,
        patientId,
        entityType: 'vital_entry',
        entityId: submissionId,
        action: 'delete',
        changes: JSON.stringify(
          rows.map((row) => ({
            field: row.kind,
            from: row.value,
            to: null,
            date: row.observedDate,
            time: row.observedTime,
          })),
        ),
        occurredAt: new Date().toISOString(),
      });

      return { deleted: rows.length };
    }),
  );
}
