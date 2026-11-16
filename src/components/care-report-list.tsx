'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { formatDe } from '@/lib/date';
import { SHIFT_LABELS, type CareReport, type CareReportRevision } from '@/lib/types';

export interface CareReportListProps {
  patientId: string;
  reports: CareReport[];
}

export function CareReportList({ patientId, reports }: CareReportListProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [history, setHistory] = useState<CareReportRevision[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  function startEditing(report: CareReport) {
    setEditingId(report.id);
    setDraft(report.body);
    setError(null);
  }

  async function saveEdit(report: CareReport) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/patients/${patientId}/reports/${report.id}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ version: report.version, body: draft }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string; fields?: Record<string, string> } }
          | null;
        setError(
          payload?.error?.fields?.body ??
            payload?.error?.message ??
            'Die Änderung konnte nicht gespeichert werden.',
        );
        return;
      }
      setEditingId(null);
      router.refresh();
    } catch {
      setError('Die Änderung konnte nicht gespeichert werden.');
    } finally {
      setPending(false);
    }
  }

  async function toggleHistory(report: CareReport) {
    if (historyId === report.id) {
      setHistoryId(null);
      return;
    }
    setHistoryId(report.id);
    setHistoryError(null);
    try {
      const response = await fetch(
        `/api/patients/${patientId}/reports/${report.id}/revisions`,
      );
      if (!response.ok) {
        setHistoryError('Der Verlauf konnte nicht geladen werden.');
        return;
      }
      const payload = (await response.json()) as { revisions: CareReportRevision[] };
      setHistory(payload.revisions);
    } catch {
      setHistoryError('Der Verlauf konnte nicht geladen werden.');
    }
  }

  if (reports.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
        Für diesen Patienten gibt es noch keine Pflegeberichte.
      </p>
    );
  }

  return (
    <ol className="space-y-3" data-testid="care-report-list">
      {reports.map((report) => (
        <li key={report.id} className="rounded-lg border border-line bg-surface p-4 shadow-panel">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-ink">{formatDe(report.observedDate)}</span>
            <span className="text-ink-muted">{report.observedTime} Uhr</span>
            <span className="rounded bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
              {SHIFT_LABELS[report.shift]}
            </span>
            {report.version > 1 ? (
              <span className="rounded bg-surface-muted px-2 py-0.5 text-xs text-ink-muted">
                bearbeitet
              </span>
            ) : null}
          </div>

          {editingId === report.id ? (
            <div className="mt-3 space-y-2">
              <textarea
                value={draft}
                rows={4}
                aria-label={`Pflegebericht vom ${formatDe(report.observedDate)} bearbeiten`}
                onChange={(event) => setDraft(event.target.value)}
                className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
              />
              <div className="flex gap-2">
                <Button size="sm" disabled={pending} onClick={() => void saveEdit(report)}>
                  {pending ? 'Speichern…' : 'Änderung speichern'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditingId(null);
                    setError(null);
                  }}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{report.body}</p>
          )}

          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => startEditing(report)}>
              Bearbeiten
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void toggleHistory(report)}>
              {historyId === report.id ? 'Verlauf schließen' : 'Verlauf'}
            </Button>
          </div>

          {error && editingId === report.id ? (
            <p role="alert" className="mt-2 text-xs font-medium text-danger">
              {error}
            </p>
          ) : null}

          {historyId === report.id ? (
            <section
              aria-label="Verlauf"
              data-testid="care-report-history"
              className="mt-3 rounded-md border border-line bg-surface-muted p-3"
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Frühere Fassungen (nur lesbar)
              </h3>
              {historyError ? (
                <p role="alert" className="mt-1 text-xs text-danger">
                  {historyError}
                </p>
              ) : history.length === 0 ? (
                <p className="mt-1 text-xs text-ink-muted">Keine früheren Fassungen.</p>
              ) : (
                <ol className="mt-2 space-y-2">
                  {history.map((revision) => (
                    <li key={revision.id} className="rounded border border-line bg-surface px-2 py-1 text-xs">
                      <p className="font-medium text-ink-muted">Fassung {revision.version}</p>
                      <p className="whitespace-pre-wrap text-ink">{revision.body}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
