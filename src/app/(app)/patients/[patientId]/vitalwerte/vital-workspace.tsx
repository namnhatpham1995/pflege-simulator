'use client';

import { DatePartsPicker } from '@/components/date-parts-picker';
import { MissingValuesWarning } from '@/components/missing-values-warning';
import { VitalChart } from '@/components/vital-chart';
import { VitalsTable } from '@/components/vitals-table';
import { Button } from '@/components/ui/button';
import { formatDe } from '@/lib/date';
import { getMissingFields } from '@/lib/missing-value-policy';
import { useVitalView } from '@/state/vital-view';

export function VitalWorkspace() {
  const {
    selectedDate,
    selectDate,
    activeDate,
    activeValues,
    requirements,
    pending,
    error,
    conflict,
    clearConflict,
    reload,
  } = useVitalView();

  const missing = getMissingFields(activeValues, requirements);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Vitalwerte</h2>
          <p className="text-sm text-ink-muted">
            Acht Messwerte pro Kalendertag. Fehlende erwartete Werte sind rot markiert; optionale
            Felder dürfen leer bleiben.
          </p>
        </div>
        <DatePartsPicker value={selectedDate} onChange={selectDate} label="Ausgewähltes Datum" />
      </div>

      <p data-testid="selected-date" className="text-sm font-medium text-ink">
        Ausgewählt: {formatDe(selectedDate)}
      </p>

      {pending ? (
        <p role="status" className="text-xs text-ink-muted">
          Werte werden geladen…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {conflict ? (
        <div
          data-testid="conflict-banner"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          <p>Der Datensatz wurde zwischenzeitlich geändert. Bitte den aktuellen Stand laden.</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              clearConflict();
              void reload();
            }}
          >
            Neu laden
          </Button>
        </div>
      ) : null}

      <MissingValuesWarning date={activeDate} missing={missing} />

      <VitalChart />
      <VitalsTable />
    </section>
  );
}
