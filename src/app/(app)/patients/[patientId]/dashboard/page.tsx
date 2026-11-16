import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardDatePicker } from '@/components/dashboard-date-picker';
import { DashboardPanels } from '@/components/dashboard-panels';
import { HttpError } from '@/lib/api-error';
import { addDays, isValidCalendarDate, parseView, todayInBerlin, windowFor } from '@/lib/date';
import { requirePatientAccess } from '@/server/services/access';
import { getEntriesRange } from '@/server/services/vitals';

export const metadata = {
  title: 'Dashboard – Pflegedokumentation',
};

type SearchParams = Promise<{ view?: string; date?: string }>;

function href(patientId: string, view: 'day' | 'week', date: string): string {
  return `/patients/${patientId}/dashboard?view=${view}&date=${date}`;
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: SearchParams;
}) {
  const { patientId } = await params;

  try {
    await requirePatientAccess(patientId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }

  const { view: rawView, date: rawDate } = await searchParams;
  const view = parseView(rawView);
  const selectedDate = rawDate && isValidCalendarDate(rawDate) ? rawDate : todayInBerlin();
  const window = windowFor(view, selectedDate);
  const entries = await getEntriesRange(patientId, window.from, window.to);

  const step = view === 'week' ? 7 : 1;
  const previous = addDays(selectedDate, -step);
  const next = addDays(selectedDate, step);
  const unit = view === 'week' ? 'Woche' : 'Tag';

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Dashboard</h2>
          <p className="text-sm text-ink-muted">
            Alle gespeicherten Messwerte im gewählten Zeitraum. Nur Lesen – Einträge werden im
            Bereich Vitalwerte erfasst.
          </p>
        </div>
        <DashboardDatePicker patientId={patientId} value={selectedDate} view={view} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-line bg-surface" role="group" aria-label="Ansicht">
          <Link
            href={href(patientId, 'day', selectedDate)}
            aria-current={view === 'day' ? 'page' : undefined}
            className={
              view === 'day'
                ? 'rounded-l-md bg-accent px-3 py-1.5 text-sm font-medium text-white'
                : 'rounded-l-md px-3 py-1.5 text-sm text-ink-muted hover:text-ink'
            }
          >
            Tag
          </Link>
          <Link
            href={href(patientId, 'week', selectedDate)}
            aria-current={view === 'week' ? 'page' : undefined}
            className={
              view === 'week'
                ? 'rounded-r-md bg-accent px-3 py-1.5 text-sm font-medium text-white'
                : 'rounded-r-md px-3 py-1.5 text-sm text-ink-muted hover:text-ink'
            }
          >
            Woche
          </Link>
        </div>

        <Link
          href={href(patientId, view, previous)}
          aria-label={`Vorherige ${unit}`}
          className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-3 text-sm text-ink hover:bg-surface-muted"
        >
          ‹ Zurück
        </Link>
        <Link
          href={href(patientId, view, next)}
          aria-label={`Nächste ${unit}`}
          className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-3 text-sm text-ink hover:bg-surface-muted"
        >
          Weiter ›
        </Link>
      </div>

      <p data-testid="dashboard-label" className="text-sm font-medium text-ink">
        {window.label}
      </p>

      <DashboardPanels
        entries={entries}
        from={window.from}
        totalMinutes={window.totalMinutes}
        label={window.label}
      />
    </section>
  );
}
