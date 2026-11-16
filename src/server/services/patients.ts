import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { patients } from '@/db/schema';
import type { Actor, PatientSummary } from '@/lib/types';

/** A group sees only its assigned patient; the teacher sees all ten. */
export async function listAuthorisedPatients(actor: Actor): Promise<PatientSummary[]> {
  if (actor.type === 'group') {
    if (!actor.patientId) return [];
    return db
      .select({ id: patients.id, displayName: patients.displayName })
      .from(patients)
      .where(eq(patients.id, actor.patientId))
      .limit(1);
  }

  return db
    .select({ id: patients.id, displayName: patients.displayName })
    .from(patients)
    .orderBy(asc(patients.displayName));
}
