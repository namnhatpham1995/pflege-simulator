import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, lt, or } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  auditLog,
  careReportRevisions,
  careReports,
  patients,
  type CareReportRow,
} from '@/db/schema';
import { HttpError, validationErrorFromZod } from '@/lib/api-error';
import type { Actor, CareReport, CareReportRevision } from '@/lib/types';
import { careReportCreateSchema, careReportUpdateSchema } from '@/lib/validation/reports';
import { serialiseWrites } from '@/server/write-queue';

export const DEFAULT_REPORT_LIMIT = 20;
export const MAX_REPORT_LIMIT = 50;

function toReport(row: CareReportRow): CareReport {
  return row;
}

function requireGroupWriter(actor: Actor, patientId: string): void {
  if (actor.type !== 'group' || actor.patientId !== patientId) {
    throw HttpError.forbidden('Nur die zugeordnete Gruppe darf Pflegeberichte schreiben.');
  }
}

async function assertPatientExists(patientId: string): Promise<void> {
  const rows = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  if (!rows[0]) throw HttpError.notFound('Patient nicht gefunden.');
}

function emptyRevisionConflict(current: CareReport): HttpError {
  return new HttpError(409, 'CONFLICT', 'Der Bericht wurde zwischenzeitlich geändert.', {
    extra: { current },
  });
}

export interface ListReportsOptions {
  limit?: number;
  before?: string | null;
}

export async function listReports(
  patientId: string,
  options: ListReportsOptions = {},
): Promise<CareReport[]> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_REPORT_LIMIT, 1), MAX_REPORT_LIMIT);

  const conditions = [eq(careReports.patientId, patientId)];
  if (options.before) {
    const [date, time, id] = options.before.split('|');
    if (!date || !time || !id) {
      throw HttpError.validation({ before: 'Der Cursor hat ein unbekanntes Format.' });
    }
    const cursor = or(
      lt(careReports.observedDate, date),
      and(
        eq(careReports.observedDate, date),
        or(
          lt(careReports.observedTime, time),
          and(eq(careReports.observedTime, time), lt(careReports.id, id)),
        ),
      ),
    );
    if (cursor) conditions.push(cursor);
  }

  const rows = await db
    .select()
    .from(careReports)
    .where(and(...conditions))
    .orderBy(
      desc(careReports.observedDate),
      desc(careReports.observedTime),
      desc(careReports.id),
    )
    .limit(limit);

  return rows.map(toReport);
}

export async function createReport(
  actor: Actor,
  patientId: string,
  input: unknown,
): Promise<CareReport> {
  requireGroupWriter(actor, patientId);
  const parsed = careReportCreateSchema.safeParse(input);
  if (!parsed.success) throw validationErrorFromZod(parsed.error);

  await assertPatientExists(patientId);

  const now = new Date().toISOString();
  const data = parsed.data;

  return serialiseWrites(async () => {
    const inserted = await db
      .insert(careReports)
      .values({
        id: randomUUID(),
        patientId,
        groupId: actor.type === 'group' ? actor.id : null,
        observedDate: data.observedDate,
        observedTime: data.observedTime,
        shift: data.shift,
        body: data.body,
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const report = toReport(inserted[0]!);
    await db.insert(auditLog).values({
      id: randomUUID(),
      actorType: actor.type,
      actorId: actor.id,
      patientId,
      entityType: 'care_report',
      entityId: report.id,
      action: 'create',
      changes: JSON.stringify([{ field: 'body', from: null, to: report.body }]),
      occurredAt: now,
    });
    return report;
  });
}

/**
 * Updates the body only. The previous body is kept as an immutable revision, so
 * an edit never silently replaces what was written.
 */
export async function updateReport(
  actor: Actor,
  patientId: string,
  reportId: string,
  input: unknown,
): Promise<CareReport> {
  requireGroupWriter(actor, patientId);
  const parsed = careReportUpdateSchema.safeParse(input);
  if (!parsed.success) throw validationErrorFromZod(parsed.error);

  const now = new Date().toISOString();

  return serialiseWrites(() =>
    db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(careReports)
        .where(and(eq(careReports.id, reportId), eq(careReports.patientId, patientId)))
        .limit(1);
      const existing = rows[0];
      if (!existing) throw HttpError.notFound('Pflegebericht nicht gefunden.');
      if (existing.version !== parsed.data.version) {
        throw emptyRevisionConflict(toReport(existing));
      }

      const updated = await tx
        .update(careReports)
        .set({
          body: parsed.data.body,
          version: existing.version + 1,
          updatedAt: now,
        })
        .where(and(eq(careReports.id, reportId), eq(careReports.version, existing.version)))
        .returning();

      if (!updated[0]) throw emptyRevisionConflict(toReport(existing));

      await tx.insert(careReportRevisions).values({
        id: randomUUID(),
        reportId,
        version: existing.version,
        body: existing.body,
        actorType: actor.type,
        actorId: actor.id,
        createdAt: now,
      });

      await tx.insert(auditLog).values({
        id: randomUUID(),
        actorType: actor.type,
        actorId: actor.id,
        patientId,
        entityType: 'care_report',
        entityId: reportId,
        action: 'update',
        changes: JSON.stringify([{ field: 'body', from: existing.body, to: parsed.data.body }]),
        occurredAt: now,
      });

      return toReport(updated[0]);
    }),
  );
}

export async function listReportRevisions(
  patientId: string,
  reportId: string,
): Promise<CareReportRevision[]> {
  const rows = await db
    .select()
    .from(careReports)
    .where(and(eq(careReports.id, reportId), eq(careReports.patientId, patientId)))
    .limit(1);
  if (!rows[0]) throw HttpError.notFound('Pflegebericht nicht gefunden.');

  return db
    .select()
    .from(careReportRevisions)
    .where(eq(careReportRevisions.reportId, reportId))
    .orderBy(asc(careReportRevisions.version));
}
