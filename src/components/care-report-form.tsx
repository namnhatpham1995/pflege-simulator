'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { SHIFT_LABELS, SHIFTS, type Shift } from '@/lib/types';
import { MAX_REPORT_BODY } from '@/lib/validation/reports';

export interface CareReportFormProps {
  patientId: string;
  defaultDate: string;
  defaultTime: string;
}

export function CareReportForm({ patientId, defaultDate, defaultTime }: CareReportFormProps) {
  const router = useRouter();
  const [observedDate, setObservedDate] = useState(defaultDate);
  const [observedTime, setObservedTime] = useState(defaultTime);
  const [shift, setShift] = useState<Shift>('frueh');
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const nearLimit = text.length > MAX_REPORT_BODY - 200;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch(`/api/patients/${patientId}/reports`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ observedDate, observedTime, shift, body: text }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string; fields?: Record<string, string> } }
          | null;
        setError(
          payload?.error?.fields?.body ??
            payload?.error?.message ??
            'Der Bericht konnte nicht gespeichert werden.',
        );
        return;
      }

      setText('');
      setSaved(true);
      router.refresh();
    } catch {
      setError('Der Bericht konnte nicht gespeichert werden.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-line bg-surface p-4 shadow-panel">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Datum" htmlFor="report-date" required>
          <input
            id="report-date"
            type="date"
            value={observedDate}
            required
            onChange={(event) => setObservedDate(event.target.value)}
            className="h-10 rounded-md border border-line bg-surface px-3 text-sm text-ink"
          />
        </Field>
        <Field label="Uhrzeit" htmlFor="report-time" required>
          <input
            id="report-time"
            type="time"
            value={observedTime}
            required
            onChange={(event) => setObservedTime(event.target.value)}
            className="h-10 rounded-md border border-line bg-surface px-3 text-sm text-ink"
          />
        </Field>
        <Field label="Schicht" htmlFor="report-shift" required>
          <select
            id="report-shift"
            value={shift}
            onChange={(event) => setShift(event.target.value as Shift)}
            className="h-10 rounded-md border border-line bg-surface px-3 text-sm text-ink"
          >
            {SHIFTS.map((option) => (
              <option key={option} value={option}>
                {SHIFT_LABELS[option]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Pflegebericht" htmlFor="report-body" required>
        <textarea
          id="report-body"
          value={text}
          rows={5}
          maxLength={MAX_REPORT_BODY}
          required
          onChange={(event) => setText(event.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn('text-xs', nearLimit ? 'font-semibold text-danger' : 'text-ink-muted')}>
          {text.length} / {MAX_REPORT_BODY} Zeichen
        </p>
        <Button type="submit" disabled={pending || text.trim().length === 0}>
          {pending ? 'Wird gespeichert…' : 'Bericht speichern'}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="rounded-md border border-line bg-surface-muted px-3 py-2 text-sm text-ink">
          Der Pflegebericht wurde gespeichert.
        </p>
      ) : null}
    </form>
  );
}
