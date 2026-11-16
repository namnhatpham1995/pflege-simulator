import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { patients } from '@/db/schema';
import { HttpError } from '@/lib/api-error';
import type { Actor, PatientSummary } from '@/lib/types';
import { requireActor } from '@/server/auth/session';

export interface PatientAccess {
  actor: Actor;
  patient: PatientSummary;
}

/**
 * The single authorisation path shared by server components and route handlers.
 * A group reaches only its assigned patient; the teacher reaches every patient.
 */
export async function requirePatientAccess(
  patientId: string,
  request?: Request,
): Promise<PatientAccess> {
  const actor = await requireActor(request);

  const rows = await db
    .select({ id: patients.id, displayName: patients.displayName })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  const patient = rows[0];
  if (!patient) throw HttpError.notFound('Patient nicht gefunden.');

  if (actor.type === 'teacher') return { actor, patient };
  if (actor.patientId !== patientId) throw HttpError.forbidden();

  return { actor, patient };
}

export async function requireTeacher(request?: Request): Promise<Actor> {
  const actor = await requireActor(request);
  if (actor.type !== 'teacher') throw HttpError.forbidden('Nur für die Lehrkraft.');
  return actor;
}

/** Compares the Origin header with the request URL; rejects absent or foreign origins. */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  const expected = new URL(request.url).origin;
  if (!origin || origin !== expected) throw HttpError.origin();
}
