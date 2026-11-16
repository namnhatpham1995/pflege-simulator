'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { VitalField } from '@/lib/types';
import { useVitalView } from '@/state/vital-view';

export interface VitalCellEditorProps {
  date: string;
  field: VitalField;
  label: string;
  unit: string;
  value: number | null;
  missing: boolean;
  active: boolean;
}

export function VitalCellEditor({
  date,
  field,
  label,
  unit,
  value,
  missing,
  active,
}: VitalCellEditorProps) {
  const { saveField } = useVitalView();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  function cancelHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  /** Touch users can press and hold a cell instead of tapping it. */
  function beginHold(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== 'touch') return;
    cancelHold();
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      startEditing();
    }, 450);
  }

  function startEditing() {
    setDraft(value === null ? '' : String(value));
    setError(null);
    setEditing(true);
  }

  async function commit() {
    const trimmed = draft.trim();
    const parsed = trimmed === '' ? null : Number(trimmed.replace(',', '.'));
    if (parsed !== null && !Number.isFinite(parsed)) {
      setError('Zahl erwartet.');
      return;
    }
    setSaving(true);
    const ok = await saveField(field, parsed);
    setSaving(false);
    if (ok) {
      setEditing(false);
      setError(null);
    } else {
      // The typed value stays visible so nothing is lost on a conflict.
      setError('Nicht gespeichert.');
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEditing}
        onPointerDown={beginHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        aria-label={`${label} am ${date} ${value === null ? 'fehlt' : `= ${value} ${unit}`}`}
        className={cn(
          'h-8 w-full rounded px-1 text-sm tabular-nums',
          missing
            ? 'bg-danger-soft font-semibold text-danger'
            : 'text-ink hover:bg-surface-muted',
          active && !missing ? 'bg-accent-soft' : '',
        )}
      >
        {value === null ? 'Fehlt' : value}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-stretch gap-1">
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the cell was just clicked
        autoFocus
        value={draft}
        inputMode="decimal"
        aria-label={`${label} am ${date} eingeben (${unit})`}
        aria-invalid={error ? true : undefined}
        disabled={saving}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (!saving) void commit();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void commit();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setEditing(false);
            setError(null);
          }
        }}
        className="h-8 w-16 rounded border border-accent bg-surface px-1 text-sm tabular-nums outline outline-2 outline-accent"
      />
      {error ? (
        <span role="alert" className="text-[10px] font-medium text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
