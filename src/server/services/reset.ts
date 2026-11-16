import { db } from '@/db/client';
import { auditLog, careReportRevisions, careReports, vitalDailyRecords } from '@/db/schema';
import { HttpError } from '@/lib/api-error';
import type { Actor } from '@/lib/types';
import { RESET_CONFIRMATION } from '@/lib/validation/reset';
import { serialiseWrites } from '@/server/write-queue';

export interface ResetCounts {
  vitals: number;
  reports: number;
  revisions: number;
  audit: number;
}

/**
 * Removes the term's documentation in one transaction. Patients, groups,
 * access-code hashes and the measurement policy survive.
 */
export async function resetClassData(actor: Actor, confirm: string): Promise<ResetCounts> {
  if (actor.type !== 'teacher') {
    throw HttpError.forbidden('Nur die Lehrkraft darf Klassendaten zurücksetzen.');
  }
  if (confirm !== RESET_CONFIRMATION) {
    throw HttpError.validation({
      confirm: `Zum Zurücksetzen muss confirm "${RESET_CONFIRMATION}" lauten.`,
    });
  }

  return serialiseWrites(() =>
    db.transaction(async (tx) => {
      const revisions = await tx.delete(careReportRevisions).returning({ id: careReportRevisions.id });
      const reports = await tx.delete(careReports).returning({ id: careReports.id });
      const vitals = await tx.delete(vitalDailyRecords).returning({ id: vitalDailyRecords.id });
      const audits = await tx.delete(auditLog).returning({ id: auditLog.id });

      return {
        vitals: vitals.length,
        reports: reports.length,
        revisions: revisions.length,
        audit: audits.length,
      };
    }),
  );
}
