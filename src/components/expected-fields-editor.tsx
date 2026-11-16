'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { VITAL_FIELDS, VITAL_FIELD_LABELS, type Requirements, type VitalField } from '@/lib/types';
import { RESET_CONFIRMATION } from '@/lib/validation/reset';

export interface ExpectedFieldsEditorProps {
  patientId: string;
  initialRequirements: Requirements;
}

export function ExpectedFieldsEditor({ patientId, initialRequirements }: ExpectedFieldsEditorProps) {
  const router = useRouter();
  const [requirements, setRequirements] = useState(initialRequirements);
  const [pendingField, setPendingField] = useState<VitalField | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function toggle(field: VitalField) {
    const expected = !requirements[field];
    setPendingField(field);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch(`/api/patients/${patientId}/requirements`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ field, expected }),
      });

      if (!response.ok) {
        setError('Die Erwartung konnte nicht gespeichert werden.');
        return;
      }

      const payload = (await response.json()) as { requirements: Requirements };
      // The saved state comes from the server, never from the click.
      setRequirements(payload.requirements);
      setSaved(true);
      router.refresh();
    } catch {
      setError('Die Erwartung konnte nicht gespeichert werden.');
    } finally {
      setPendingField(null);
    }
  }

  return (
    <div className="space-y-3">
      <ul className="grid gap-2 sm:grid-cols-2">
        {VITAL_FIELDS.map((field) => {
          const expected = requirements[field];
          return (
            <li
              key={field}
              className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2"
            >
              <span className="text-sm text-ink">{VITAL_FIELD_LABELS[field]}</span>
              <button
                type="button"
                role="switch"
                aria-checked={expected}
                aria-label={`${VITAL_FIELD_LABELS[field]} als erwartet markieren`}
                disabled={pendingField === field}
                onClick={() => void toggle(field)}
                className={cn(
                  'relative h-6 w-11 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                  expected ? 'bg-accent' : 'bg-slate-300',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
                    expected ? 'left-[22px]' : 'left-0.5',
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-xs text-ink-muted">Die Erwartungen wurden gespeichert.</p>
      ) : null}
    </div>
  );
}

export function ResetClassDataButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    if (!window.confirm('Alle Vitalwerte, Pflegeberichte und Protokolle löschen?')) return;
    setPending(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/reset-class-data', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: RESET_CONFIRMATION }),
      });
      if (!response.ok) {
        setError('Das Zurücksetzen ist fehlgeschlagen.');
        return;
      }
      const payload = (await response.json()) as {
        deleted: { vitals: number; reports: number; revisions: number; audit: number };
      };
      setResult(
        `Gelöscht: ${payload.deleted.vitals} Vitalwerte, ${payload.deleted.reports} Pflegeberichte, ${payload.deleted.revisions} Fassungen.`,
      );
      router.refresh();
    } catch {
      setError('Das Zurücksetzen ist fehlgeschlagen.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="danger" size="sm" onClick={() => void reset()} disabled={pending}>
        {pending ? 'Wird zurückgesetzt…' : 'Klassendaten zurücksetzen'}
      </Button>
      {result ? <p className="text-xs text-ink-muted">{result}</p> : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
