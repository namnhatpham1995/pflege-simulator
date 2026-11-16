'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DatePartsPicker } from '@/components/date-parts-picker';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { formatDe } from '@/lib/date';
import type { PatientSummary } from '@/lib/types';

export interface PatientDetailsDialogProps {
  patient: PatientSummary;
}

export function PatientDetailsDialog({ patient }: PatientDetailsDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(patient.displayName);
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(patient.dateOfBirth);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function openDialog() {
    setName(patient.displayName);
    setDateOfBirth(patient.dateOfBirth);
    setErrors({});
    setMessage(null);
    setOpen(true);
  }

  async function save() {
    setPending(true);
    setErrors({});
    setMessage(null);
    try {
      const response = await fetch(`/api/patients/${patient.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName: name, dateOfBirth }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string; fields?: Record<string, string> } }
          | null;
        setErrors(payload?.error?.fields ?? {});
        setMessage(payload?.error?.message ?? 'Die Patientendaten konnten nicht gespeichert werden.');
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setMessage('Die Patientendaten konnten nicht gespeichert werden.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={openDialog}>
        Patientendaten bearbeiten
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Patientendaten bearbeiten"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Abbrechen
            </Button>
            <Button onClick={() => void save()} disabled={pending}>
              {pending ? 'Speichern…' : 'Speichern'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="patient-name" error={errors.displayName} required>
            <input
              id="patient-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-10 rounded-md border border-line bg-surface px-3 text-sm text-ink"
            />
          </Field>

          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">Geburtsdatum</p>
            {dateOfBirth ? (
              <>
                <DatePartsPicker
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  label="Geburtsdatum"
                />
                <p className="text-xs text-ink-muted">Gespeichert: {formatDe(dateOfBirth)}</p>
              </>
            ) : (
              <p className="text-xs text-ink-muted">Geburtsdatum nicht angegeben</p>
            )}
            {errors.dateOfBirth ? (
              <p role="alert" className="text-xs font-medium text-danger">
                {errors.dateOfBirth}
              </p>
            ) : null}
            {dateOfBirth ? (
              <Button variant="ghost" size="sm" onClick={() => setDateOfBirth(null)}>
                Geburtsdatum löschen
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setDateOfBirth('1950-01-01')}>
                Geburtsdatum festlegen
              </Button>
            )}
          </div>

          {message ? (
            <p role="alert" className="text-xs font-medium text-danger">
              {message}
            </p>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
