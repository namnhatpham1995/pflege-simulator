'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { daysInMonth, toIsoDate } from '@/lib/date';

export const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const;

export const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

export interface CalendarPopoverProps {
  value: string;
  onSelect: (date: string) => void;
  onClose: () => void;
  className?: string;
}

export function CalendarPopover({ value, onSelect, onClose, className }: CalendarPopoverProps) {
  const initialYear = Number(value.slice(0, 4)) || new Date().getUTCFullYear();
  const initialMonth = Number(value.slice(5, 7)) || 1;

  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLButtonElement>('button[data-day]');
    first?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const totalDays = daysInMonth(year, month);
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];

  function shiftMonth(delta: number): void {
    const next = month + delta;
    if (next < 1) {
      setMonth(12);
      setYear((current) => current - 1);
    } else if (next > 12) {
      setMonth(1);
      setYear((current) => current + 1);
    } else {
      setMonth(next);
    }
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Kalender"
      className={cn(
        'absolute z-30 mt-1 w-64 rounded-lg border border-line bg-surface p-3 shadow-panel',
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <Button variant="ghost" size="sm" aria-label="Vorheriger Monat" onClick={() => shiftMonth(-1)}>
          ‹
        </Button>
        <p className="text-sm font-medium text-ink" aria-live="polite">
          {MONTH_NAMES[month - 1]} {year}
        </p>
        <Button variant="ghost" size="sm" aria-label="Nächster Monat" onClick={() => shiftMonth(1)}>
          ›
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-ink-muted">
        {WEEKDAY_LABELS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day === null) return <span key={`empty-${index}`} aria-hidden="true" />;
          const iso = toIsoDate(year, month, day);
          const isSelected = iso === value;
          return (
            <button
              key={day}
              type="button"
              data-day={day}
              aria-label={`${day}. ${MONTH_NAMES[month - 1]} ${year}`}
              aria-pressed={isSelected}
              onClick={() => onSelect(iso)}
              className={cn(
                'h-8 rounded-md text-sm',
                isSelected
                  ? 'bg-accent text-white'
                  : 'text-ink hover:bg-surface-muted focus-visible:bg-accent-soft',
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
