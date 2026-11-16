'use client';

import { useEntryHover } from '@/components/entry-hover';
import { cn } from '@/lib/cn';
import { formatDeDateTime } from '@/lib/date';
import {
  VITAL_FIELDS,
  VITAL_FIELD_LABELS,
  VITAL_FIELD_UNITS,
  type VitalEntry,
} from '@/lib/types';
import { formatVitalValue } from '@/lib/vitals';

export function EntryRows({ entries }: { entries: VitalEntry[] }) {
  const { hoveredId, setHoveredId, toggleHovered } = useEntryHover();

  return (
    <div className="divide-y divide-line rounded-lg border border-line bg-surface shadow-panel">
      {VITAL_FIELDS.map((kind) => {
        const kindEntries = entries.filter((entry) => entry.kind === kind);
        return (
          <div
            key={kind}
            data-testid={`entry-row-${kind}`}
            className="flex flex-wrap items-start gap-2 px-3 py-2"
          >
            <div className="w-44 shrink-0 text-sm">
              <span className="text-ink">{VITAL_FIELD_LABELS[kind]}</span>
              <span className="ml-1 text-xs text-ink-muted">({VITAL_FIELD_UNITS[kind]})</span>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap gap-1" role="list" aria-label={VITAL_FIELD_LABELS[kind]}>
              {kindEntries.length === 0 ? (
                <span className="text-xs text-ink-muted">Keine Einträge</span>
              ) : null}
              {kindEntries.map((entry) => {
                const active = hoveredId === entry.id;
                const tooltipId = `entry-tooltip-${entry.id}`;
                const label = VITAL_FIELD_LABELS[kind];
                const value = formatVitalValue(kind, entry.value);
                const unit = VITAL_FIELD_UNITS[kind];
                const when = formatDeDateTime(entry.observedDate, entry.observedTime);

                return (
                  <span key={entry.id} role="listitem" className="relative inline-flex">
                    <button
                      type="button"
                      data-entry-box="true"
                      data-entry-id={entry.id}
                      data-kind={kind}
                      data-highlighted={active ? 'true' : undefined}
                      aria-label={`${label} ${value} ${unit}, ${when}`}
                      aria-describedby={active ? tooltipId : undefined}
                      onPointerEnter={(event) => {
                        if (event.pointerType !== 'touch') setHoveredId(entry.id);
                      }}
                      onPointerLeave={(event) => {
                        if (event.pointerType !== 'touch') setHoveredId(null);
                      }}
                      onFocus={() => setHoveredId(entry.id)}
                      onBlur={() => setHoveredId(null)}
                      onPointerDown={(event) => {
                        if (event.pointerType === 'touch') toggleHovered(entry.id);
                      }}
                      className={cn(
                        'inline-flex h-8 min-w-[3rem] items-center justify-center rounded-md border px-2 text-sm tabular-nums',
                        active
                          ? 'border-accent bg-accent-soft font-medium text-accent'
                          : 'border-line bg-surface text-ink hover:border-accent',
                      )}
                    >
                      {value}
                    </button>
                    {active ? (
                      <span
                        role="tooltip"
                        id={tooltipId}
                        className="absolute bottom-full left-0 z-10 mb-1 whitespace-nowrap rounded border border-line bg-surface px-2 py-1 text-xs text-ink shadow-panel"
                      >
                        {when}
                      </span>
                    ) : null}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
