import { PatientDetailsDialog } from '@/components/patient-details-dialog';
import { formatDe } from '@/lib/date';
import type { PatientSummary } from '@/lib/types';

export interface PatientHeaderProps {
  patient: PatientSummary;
  canEdit: boolean;
}

export function PatientHeader({ patient, canEdit }: PatientHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line bg-surface p-4 shadow-panel">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Fiktiver Patient
        </p>
        <h1 className="text-xl font-semibold text-ink">{patient.displayName}</h1>
        <p className="text-xs text-ink-muted">
          {patient.dateOfBirth
            ? `Geburtsdatum: ${formatDe(patient.dateOfBirth)}`
            : 'Geburtsdatum nicht angegeben'}
        </p>
      </div>
      {canEdit ? <PatientDetailsDialog patient={patient} /> : null}
    </div>
  );
}
