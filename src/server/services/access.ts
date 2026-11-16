import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { patients } from '@/db/schema';
import { HttpError } from '@/lib/api-error';
import type { Actor, PatientSummary } from '@/lib/types';
import { readSessionToken, resolveActorFromToken, requireActor } from '@/server/auth/session';

export interface PatientAccess {
  actor: Actor;
  patient: PatientSummary;
}

export function anonymousActor(patientId: string): Actor {
  return {
    type: 'group',
    id: `patient:${patientId}`,
    displayName: 'Anonymer Gast',
    patientId,
  };
}

/**
 * A teacher session is honoured; everything else, including no session, is an
 * anonymous student of the named patient. Group sessions no longer exist.
 */
export async function resolveVisitor(patientId: string, request?: Request): Promise<Actor> {
  const token = await readSessionToken(request);
  if (token) {
    const actor = await resolveActorFromToken(token);
    if (actor?.type === 'teacher') return actor;
  }
  return anonymousActor(patientId);
}

function toPatient(row: {
  id: string;
  displayName: string;
  dateOfBirth: string | null;
}): PatientSummary {
  return row;
}

/**
 * The single authorisation path shared by server components and route handlers.
 * It only proves the patient exists; anyone may read and write the workspace.
 */
export async function requirePatientAccess(
  patientId: string,
  request?: Request,
): Promise<PatientAccess> {
  const actor = await resolveVisitor(patientId, request);

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

  return { actor, patient: toPatient(patient) };
}

export async function requireTeacher(request?: Request): Promise<Actor> {
  const actor = await requireActor(request);
  if (actor.type !== 'teacher') throw HttpError.forbidden('Nur für die Lehrkraft.');
  return actor;
}

/** Measurement entries and care reports are written by students, never the teacher. */
export function assertStudentWrite(actor: Actor): void {
  if (actor.type === 'teacher') {
    throw HttpError.forbidden('Die Lehrkraft hat nur lesenden Zugriff.');
  }
}

/** Compares the Origin header with the request URL; rejects absent or foreign origins. */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  const expected = new URL(request.url).origin;
  if (!origin || origin !== expected) throw HttpError.origin();
}
