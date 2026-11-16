'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { daysInMonth, isValidCalendarDate, toIsoDate } from '@/lib/date';
import { CalendarPopover, MONTH_NAMES } from './calendar-popover';

type Part = 'day' | 'month' | 'year';

export interface DatePartsPickerProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  className?: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

const fieldClass =
  'h-9 w-full rounded-md border border-line bg-surface px-2 text-sm text-ink tabular-nums';

export function DatePartsPicker({ value, onChange, label = 'Datum', className }: DatePartsPickerProps) {
  const baseId = useId();
  const [day, setDay] = useState(() => value.slice(8, 10));
  const [month, setMonth] = useState(() => value.slice(5, 7));
  const [year, setYear] = useState(() => value.slice(0, 4));
  const [openPart, setOpenPart] = useState<Part | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastValue, setLastValue] = useState(value);

  const containerRef = useRef<HTMLDivElement>(null);
  const dayInputRef = useRef<HTMLInputElement>(null);
  const monthInputRef = useRef<HTMLInputElement>(null);
  const yearInputRef = useRef<HTMLInputElement>(null);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);

  // Adjusting the drafts during render (React's documented pattern) keeps the
  // controls in step with the committed value without an effect cascade.
  if (value !== lastValue) {
    setLastValue(value);
    setDay(value.slice(8, 10));
    setMonth(value.slice(5, 7));
    setYear(value.slice(0, 4));
    setError(null);
    setOpenPart(null);
    setCalendarOpen(false);
  }

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpenPart(null);
        setCalendarOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const numericMonth = Number(month);
  const numericYear = Number(year);
  const monthIsValid = Number.isInteger(numericMonth) && numericMonth >= 1 && numericMonth <= 12;
  const yearIsValid = Number.isInteger(numericYear) && numericYear >= 1;
  const dayCount = monthIsValid ? daysInMonth(yearIsValid ? numericYear : 2000, numericMonth) : 31;
  const yearListBase = yearIsValid ? numericYear : new Date().getUTCFullYear();
  const yearOptions = Array.from({ length: 21 }, (_, index) => yearListBase - 10 + index);

  function commit(nextDay = day, nextMonth = month, nextYear = year): void {
    const d = Number(nextDay);
    const m = Number(nextMonth);
    const y = Number(nextYear);

    if (nextDay.trim() === '' || nextMonth.trim() === '' || nextYear.trim() === '') {
      setError(null);
      return;
    }
    if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y) || y < 1) {
      setError('Bitte Tag, Monat und Jahr als Zahl eingeben.');
      return;
    }

    const iso = toIsoDate(y, m, d);
    if (!isValidCalendarDate(iso)) {
      setError(`Das Datum ${pad(d)}.${pad(m)}.${y} existiert nicht.`);
      return;
    }

    setError(null);
    if (iso !== value) onChange(iso);
  }

  function closeList(returnFocusTo?: Part): void {
    setOpenPart(null);
    if (returnFocusTo === 'day') dayInputRef.current?.focus();
    if (returnFocusTo === 'month') monthInputRef.current?.focus();
    if (returnFocusTo === 'year') yearInputRef.current?.focus();
  }

  function handleListKeyDown(event: React.KeyboardEvent<HTMLDivElement>, columns: number): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeList(openPart ?? undefined);
      return;
    }
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'];
    if (!keys.includes(event.key)) return;

    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button'),
    );
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const delta =
      event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowLeft'
          ? -1
          : event.key === 'ArrowDown'
            ? columns
            : -columns;

    event.preventDefault();
    const next = buttons[Math.max(0, Math.min(buttons.length - 1, index + delta))];
    next?.focus();
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>, part: Part): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
      setOpenPart(null);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeList(part);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpenPart(part);
      const list = containerRef.current?.querySelector<HTMLElement>(`[data-list="${part}"]`);
      const buttons = list ? Array.from(list.querySelectorAll<HTMLButtonElement>('button')) : [];
      const target = event.key === 'ArrowDown' ? buttons[0] : buttons[buttons.length - 1];
      target?.focus();
    }
  }

  function handleBlur(event: React.FocusEvent<HTMLInputElement>): void {
    const next = event.relatedTarget as Node | null;
    if (next && containerRef.current?.contains(next)) return;
    commit();
  }

  const optionClass = (isSelected: boolean) =>
    cn(
      'h-8 rounded-md text-sm',
      isSelected ? 'bg-accent text-white' : 'text-ink hover:bg-surface-muted',
    );

  const idPrefix = `${baseId}-date`;
  const errorId = `${idPrefix}-error`;

  return (
    <div className={cn('inline-flex flex-col gap-1', className)}>
      <div
        ref={containerRef}
        className="relative flex flex-wrap items-end gap-2"
        role="group"
        aria-label={label}
      >
        <div className="w-16">
          <label htmlFor={`${idPrefix}-day`} className="mb-1 block text-xs font-medium text-ink-muted">
            Tag
          </label>
          <input
            id={`${idPrefix}-day`}
            ref={dayInputRef}
            value={day}
            inputMode="numeric"
            autoComplete="off"
            maxLength={2}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onClick={() => setOpenPart('day')}
            onChange={(event) => setDay(event.target.value.replace(/\D/g, ''))}
            onKeyDown={(event) => handleInputKeyDown(event, 'day')}
            onBlur={handleBlur}
            className={fieldClass}
          />
        </div>

        <div className="w-24">
          <label htmlFor={`${idPrefix}-month`} className="mb-1 block text-xs font-medium text-ink-muted">
            Monat
          </label>
          <input
            id={`${idPrefix}-month`}
            ref={monthInputRef}
            value={month}
            inputMode="numeric"
            autoComplete="off"
            maxLength={2}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onClick={() => setOpenPart('month')}
            onChange={(event) => setMonth(event.target.value.replace(/\D/g, ''))}
            onKeyDown={(event) => handleInputKeyDown(event, 'month')}
            onBlur={handleBlur}
            className={fieldClass}
          />
        </div>

        <div className="w-24">
          <label htmlFor={`${idPrefix}-year`} className="mb-1 block text-xs font-medium text-ink-muted">
            Jahr
          </label>
          <input
            id={`${idPrefix}-year`}
            ref={yearInputRef}
            value={year}
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onClick={() => setOpenPart('year')}
            onChange={(event) => setYear(event.target.value.replace(/\D/g, ''))}
            onKeyDown={(event) => handleInputKeyDown(event, 'year')}
            onBlur={handleBlur}
            className={fieldClass}
          />
        </div>

        <button
          ref={calendarButtonRef}
          type="button"
          aria-label="Kalender öffnen"
          aria-expanded={calendarOpen}
          onClick={() => setCalendarOpen((open) => !open)}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-surface-muted"
        >
          <span aria-hidden="true">▦</span>
        </button>

        {openPart === 'day' ? (
          <div
            role="group"
            aria-label="Tag"
            data-list="day"
            onKeyDown={(event) => handleListKeyDown(event, 7)}
            className="absolute left-0 top-full z-20 mt-1 grid max-h-48 w-56 grid-cols-7 gap-1 overflow-y-auto rounded-lg border border-line bg-surface p-2 shadow-panel"
          >
            {Array.from({ length: dayCount }, (_, index) => index + 1).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={Number(day) === option}
                onClick={() => {
                  const nextDay = String(option);
                  setDay(nextDay);
                  commit(nextDay, month, year);
                  setOpenPart(null);
                }}
                className={optionClass(Number(day) === option)}
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}

        {openPart === 'month' ? (
          <div
            role="group"
            aria-label="Monat"
            data-list="month"
            onKeyDown={(event) => handleListKeyDown(event, 3)}
            className="absolute left-0 top-full z-20 mt-1 grid w-56 grid-cols-3 gap-1 rounded-lg border border-line bg-surface p-2 shadow-panel"
          >
            {MONTH_NAMES.map((name, index) => {
              const option = index + 1;
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={Number(month) === option}
                  onClick={() => {
                    const nextMonth = pad(option);
                    const maxDay = daysInMonth(yearIsValid ? numericYear : 2000, option);
                    const nextDay = Number(day) > maxDay ? String(maxDay) : day;
                    setMonth(nextMonth);
                    setDay(nextDay);
                    commit(nextDay, nextMonth, year);
                    setOpenPart(null);
                  }}
                  className={optionClass(Number(month) === option)}
                >
                  {name}
                </button>
              );
            })}
          </div>
        ) : null}

        {openPart === 'year' ? (
          <div
            role="group"
            aria-label="Jahr"
            data-list="year"
            onKeyDown={(event) => handleListKeyDown(event, 4)}
            className="absolute left-0 top-full z-20 mt-1 grid max-h-48 w-56 grid-cols-4 gap-1 overflow-y-auto rounded-lg border border-line bg-surface p-2 shadow-panel"
          >
            {yearOptions.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={Number(year) === option}
                onClick={() => {
                  const nextYear = String(option);
                  setYear(nextYear);
                  commit(day, month, nextYear);
                  setOpenPart(null);
                }}
                className={optionClass(Number(year) === option)}
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}

        {calendarOpen ? (
          <div className="absolute left-0 top-full z-20">
            <CalendarPopover
              value={value}
              onSelect={(date) => {
                setCalendarOpen(false);
                onChange(date);
                calendarButtonRef.current?.focus();
              }}
              onClose={() => {
                setCalendarOpen(false);
                calendarButtonRef.current?.focus();
              }}
            />
          </div>
        ) : null}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
