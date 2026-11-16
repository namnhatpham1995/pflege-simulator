'use client';

import { cn } from '@/lib/cn';
import { formatDe } from '@/lib/date';
import { getMissingFields } from '@/lib/missing-value-policy';
import type { VitalField } from '@/lib/types';
import { valuesFromRecord } from '@/lib/vitals';
import { VITAL_RULE_LIST } from '@/lib/validation/vitals';
import { useVitalView } from '@/state/vital-view';
import { VitalCellEditor } from './vital-cell-editor';

export function VitalsTable() {
  const { windowDates, records, requirements, activeDate, hoverDate, selectDate } = useVitalView();

  return (
    <div
      className="overflow-x-auto rounded-lg border border-line bg-surface shadow-panel"
      onPointerLeave={() => hoverDate(null)}
    >
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Tageswerte der Vitalwerte pro Kalendertag; fehlende erwartete Werte sind rot markiert.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium text-ink-muted">
              Messwert
            </th>
            {windowDates.map((date) => {
              const isActive = date === activeDate;
              return (
                <th
                  key={date}
                  scope="col"
                  data-testid={`date-header-${date}`}
                  onPointerEnter={() => hoverDate(date)}
                  onPointerLeave={() => hoverDate(null)}
                  className={cn(
                    'border-x border-transparent px-1 py-2 text-center text-xs font-medium',
                    isActive ? 'border-accent bg-accent-soft text-accent' : 'text-ink-muted',
                  )}
                >
                  <button
                    type="button"
                    aria-current={isActive ? 'date' : undefined}
                    onFocus={() => hoverDate(date)}
                    onClick={() => selectDate(date)}
                    className="w-full rounded px-1 py-1 hover:bg-accent-soft"
                  >
                    {formatDe(date).slice(0, 5)}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {VITAL_RULE_LIST.map((rule) => (
            <tr key={rule.field} className="border-t border-line">
              <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-left font-normal">
                <span className="text-sm text-ink">{rule.label}</span>
                <span className="ml-1 text-xs text-ink-muted">({rule.unit})</span>
              </th>
              {windowDates.map((date) => {
                const record = records[date];
                const values = record ? valuesFromRecord(record) : null;
                const missingFields = getMissingFields(values, requirements);
                const missing = missingFields.includes(rule.field);
                const isActive = date === activeDate;
                const value = (values?.[rule.field] ?? null) as number | null;

                return (
                  <td
                    key={`${date}-${rule.field}`}
                    data-testid={`cell-${date}-${rule.field}`}
                    data-missing={missing ? 'true' : undefined}
                    className={cn(
                      'border-x border-transparent px-1 py-1 text-center',
                      isActive ? 'border-accent bg-accent-soft' : '',
                    )}
                  >
                    <VitalCellEditor
                      date={date}
                      field={rule.field as VitalField}
                      label={rule.label}
                      unit={rule.unit}
                      value={value}
                      missing={missing}
                      active={isActive}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
