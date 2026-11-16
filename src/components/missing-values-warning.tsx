'use client';

import { cn } from '@/lib/cn';
import { formatDe } from '@/lib/date';
import { VITAL_FIELD_LABELS, type VitalField } from '@/lib/types';

export interface MissingValuesWarningProps {
  date: string;
  missing: VitalField[];
}

export function MissingValuesWarning({ date, missing }: MissingValuesWarningProps) {
  const complete = missing.length === 0;

  return (
    <div
      aria-live="polite"
      data-testid="missing-warning"
      className={cn(
        'rounded-md border px-3 py-2 text-sm',
        complete
          ? 'border-line bg-surface text-ink-muted'
          : 'border-danger bg-danger-soft font-medium text-danger',
      )}
    >
      {complete ? (
        <p>Für {formatDe(date)} sind alle erwarteten Werte erfasst.</p>
      ) : (
        <p>
          {formatDe(date)}: Fehlende Werte: {missing.map((field) => VITAL_FIELD_LABELS[field]).join(', ')}
        </p>
      )}
    </div>
  );
}
