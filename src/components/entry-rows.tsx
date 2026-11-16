'use client';

import { useEntryHover } from '@/components/entry-hover';
import { cn } from '@/lib/cn';
import { formatDeDateTime } from '@/lib/date';
import {
  MEASUREMENT_CATEGORIES,
  VITAL_FIELD_LABELS,
  VITAL_FIELD_UNITS,
  type CategoryDefinition,
  type VitalEntry,
} from '@/lib/types';
import { formatVitalValue } from '@/lib/vitals';

/** One value box: a single entry, or the systolic/diastolic pair of one save. */
interface EntryBox {
  key: string;
  entryIds: string[];
  text: string;
  when: string;
}

function rowLabel(category: CategoryDefinition): string {
  // Blutdruck is one row showing "systolisch/diastolisch", e.g. 123/111.
  if (category.fields.length > 1) return 'Blutdruck systolisch/diastolisch';
  return VITAL_FIELD_LABELS[category.fields[0]!];
}

function boxesFor(category: CategoryDefinition, entries: VitalEntry[]): EntryBox[] {
  const fields = category.fields as readonly string[];
  const bySubmission = new Map<string, VitalEntry[]>();
  for (const entry of entries) {
    if (!fields.includes(entry.kind)) continue;
    const group = bySubmission.get(entry.submissionId);
    if (group) group.push(entry);
    else bySubmission.set(entry.submissionId, [entry]);
  }

  return [...bySubmission.entries()].map(([key, group]) => {
    const first = group[0]!;
    const text = category.fields
      .map((field) => {
        const found = group.find((entry) => entry.kind === field);
        return found ? formatVitalValue(field, found.value) : '–';
      })
      .join('/');
    return {
      key,
      entryIds: group.map((entry) => entry.id),
      text,
      when: formatDeDateTime(first.observedDate, first.observedTime),
    };
  });
}

export function EntryRows({ entries }: { entries: VitalEntry[] }) {
  const { hoveredIds, setHoveredIds, clearHovered, toggleHovered } = useEntryHover();

  return (
    <div className="divide-y divide-line rounded-lg border border-line bg-surface shadow-panel">
      {MEASUREMENT_CATEGORIES.map((category) => {
        const firstField = category.fields[0];
        const label = rowLabel(category);
        const unit = VITAL_FIELD_UNITS[firstField];
        const boxes = boxesFor(category, entries);

        return (
          <div
            key={category.key}
            data-testid={`entry-row-${firstField}`}
            data-category={category.key}
            className="flex flex-wrap items-start gap-2 px-3 py-2"
          >
            <div className="w-56 shrink-0 text-sm">
              <span className="text-ink">{label}</span>
              <span className="ml-1 text-xs text-ink-muted">({unit})</span>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap gap-1" role="list" aria-label={label}>
              {boxes.length === 0 ? (
                <span className="text-xs text-ink-muted">Keine Einträge</span>
              ) : null}
              {boxes.map((box) => {
                const active = box.entryIds.some((id) => hoveredIds.includes(id));
                const tooltipId = `entry-tooltip-${box.key}`;

                return (
                  <span key={box.key} role="listitem" className="relative inline-flex">
                    <button
                      type="button"
                      data-entry-box="true"
                      data-entry-id={box.entryIds[0]}
                      data-kind={firstField}
                      data-highlighted={active ? 'true' : undefined}
                      aria-label={`${label} ${box.text} ${unit}, ${box.when}`}
                      aria-describedby={active ? tooltipId : undefined}
                      onPointerEnter={(event) => {
                        if (event.pointerType !== 'touch') setHoveredIds(box.entryIds);
                      }}
                      onPointerLeave={(event) => {
                        if (event.pointerType !== 'touch') clearHovered();
                      }}
                      onFocus={() => setHoveredIds(box.entryIds)}
                      onBlur={clearHovered}
                      onPointerDown={(event) => {
                        if (event.pointerType === 'touch') toggleHovered(box.entryIds);
                      }}
                      className={cn(
                        'inline-flex h-8 min-w-[3rem] items-center justify-center rounded-md border px-2 text-sm tabular-nums',
                        active
                          ? 'border-accent bg-accent-soft font-medium text-accent'
                          : 'border-line bg-surface text-ink hover:border-accent',
                      )}
                    >
                      {box.text}
                    </button>
                    {active ? (
                      <span
                        role="tooltip"
                        id={tooltipId}
                        className="absolute bottom-full left-0 z-10 mb-1 whitespace-nowrap rounded border border-line bg-surface px-2 py-1 text-xs text-ink shadow-panel"
                      >
                        {box.when}
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
