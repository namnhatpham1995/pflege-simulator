'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { DatePartsPicker } from '@/components/date-parts-picker';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { formatDeDateTime, nowInBerlin, todayInBerlin } from '@/lib/date';
import {
  MEASUREMENT_CATEGORIES,
  categoryDefinition,
  type EntryGroup,
  type MeasurementCategory,
  type RecentEntries,
  type VitalField,
} from '@/lib/types';
import { formatVitalValue, RECENT_ENTRIES_LIMIT } from '@/lib/vitals';
import { VITAL_RULES } from '@/lib/validation/vitals';

export interface VitalwertePanelProps {
  patientId: string;
  recent: RecentEntries;
  canWrite: boolean;
}

function groupLabel(group: EntryGroup): string {
  return Object.entries(group.values)
    .map(([field, value]) =>
      value === undefined
        ? ''
        : `${VITAL_RULES[field as VitalField].label}: ${formatVitalValue(field as VitalField, value)} ${VITAL_RULES[field as VitalField].unit}`,
    )
    .filter(Boolean)
    .join(' · ');
}

export function VitalwertePanel({ patientId, recent, canWrite }: VitalwertePanelProps) {
  const router = useRouter();
  const initialNow = nowInBerlin();
  const [active, setActive] = useState<MeasurementCategory>('blutdruck');
  const [values, setValues] = useState<Record<string, string>>({});
  const [date, setDate] = useState(initialNow.date);
  const [time, setTime] = useState(initialNow.time);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [recentEntries, setRecentEntries] = useState<RecentEntries>(recent);
  const [deleteTarget, setDeleteTarget] = useState<EntryGroup | null>(null);
  const [deleting, setDeleting] = useState(false);

  const definition = categoryDefinition(active);
  const groups = recentEntries[active];

  function selectCategory(category: MeasurementCategory) {
    setActive(category);
    setValues({});
    setErrors({});
    setMessage(null);
    setSaved(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setErrors({});
    setMessage(null);
    setSaved(null);

    const payloadValues = Object.fromEntries(
      definition.fields.map((field) => [field, values[field] ?? '']),
    );

    try {
      const response = await fetch(`/api/patients/${patientId}/vitals`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category: active, values: payloadValues, date, time }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string; fields?: Record<string, string> } }
          | null;
        setErrors(payload?.error?.fields ?? {});
        setMessage(payload?.error?.message ?? 'Der Messwert konnte nicht gespeichert werden.');
        return;
      }

      const created = (await response.json()) as { groups: EntryGroup[] };
      setRecentEntries((current) => ({
        ...current,
        [active]: [...created.groups, ...current[active]].slice(0, RECENT_ENTRIES_LIMIT),
      }));
      setValues({});
      const now = nowInBerlin();
      setDate(now.date);
      setTime(now.time);
      setSaved('Gespeichert.');
      router.refresh();
    } catch {
      setMessage('Der Messwert konnte nicht gespeichert werden.');
    } finally {
      setPending(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(
        `/api/patients/${patientId}/vitals/${deleteTarget.submissionId}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        setMessage('Der Eintrag konnte nicht gelöscht werden.');
        return;
      }
      const submissionId = deleteTarget.submissionId;
      setRecentEntries((current) => ({
        ...current,
        [active]: current[active].filter((group) => group.submissionId !== submissionId),
      }));
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setMessage('Der Eintrag konnte nicht gelöscht werden.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Messkategorien" className="flex flex-wrap gap-1 border-b border-line">
        {MEASUREMENT_CATEGORIES.map((category) => (
          <button
            key={category.key}
            type="button"
            role="tab"
            aria-selected={active === category.key}
            onClick={() => selectCategory(category.key)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
              active === category.key
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {category.label}
          </button>
        ))}
      </div>

      {canWrite ? (
        <form
          onSubmit={save}
          className="space-y-4 rounded-lg border border-line bg-surface p-4 shadow-panel"
          data-testid={`entry-form-${active}`}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {definition.fields.map((field) => (
              <Field
                key={field}
                label={`${VITAL_RULES[field].label} (${VITAL_RULES[field].unit})`}
                htmlFor={`entry-${field}`}
                error={errors[field]}
                required
              >
                <input
                  id={`entry-${field}`}
                  value={values[field] ?? ''}
                  inputMode={VITAL_RULES[field].kind === 'integer' ? 'numeric' : 'decimal'}
                  autoComplete="off"
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [field]: event.target.value }))
                  }
                  className="h-10 rounded-md border border-line bg-surface px-3 text-sm text-ink tabular-nums"
                />
              </Field>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <DatePartsPicker value={date} onChange={setDate} label="Tag" />
            <Field label="Uhrzeit (HH:MM)" htmlFor="entry-time" error={errors.time} required>
              <input
                id="entry-time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink tabular-nums"
              />
            </Field>
          </div>

          {message ? (
            <p role="alert" className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
              {message}
            </p>
          ) : null}
          {saved ? (
            <p className="text-sm text-ink-muted">{saved}</p>
          ) : null}

          <Button type="submit" disabled={pending}>
            {pending ? 'Speichern…' : 'Speichern'}
          </Button>
        </form>
      ) : (
        <p className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-muted">
          Die Lehrkraft hat nur lesenden Zugriff auf die Messwerte.
        </p>
      )}

      <section className="space-y-2" aria-label={`Letzte Einträge – ${definition.label}`}>
        <h3 className="text-sm font-semibold text-ink">Letzte Einträge</h3>
        {groups.length === 0 ? (
          <p className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-muted">
            Noch keine Einträge in dieser Kategorie.
          </p>
        ) : (
          <ol className="divide-y divide-line rounded-lg border border-line bg-surface shadow-panel">
            {groups.map((group) => (
              <li
                key={group.submissionId}
                data-testid={`recent-${group.submissionId}`}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium text-ink">
                    {formatDeDateTime(group.observedDate, group.observedTime)}
                  </span>
                  <span className="ml-2 text-ink-muted">{groupLabel(group)}</span>
                </span>
                {canWrite ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Eintrag vom ${formatDeDateTime(group.observedDate, group.observedTime)} löschen`}
                    onClick={() => setDeleteTarget(group)}
                  >
                    Löschen
                  </Button>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Eintrag löschen"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? 'Löschen…' : 'Löschen'}
            </Button>
          </>
        }
      >
        {deleteTarget ? (
          <p className="text-sm text-ink">
            {formatDeDateTime(deleteTarget.observedDate, deleteTarget.observedTime)} –{' '}
            {groupLabel(deleteTarget)}. Der Eintrag wird endgültig entfernt.
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}
