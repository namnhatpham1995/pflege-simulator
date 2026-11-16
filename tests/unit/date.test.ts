import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareDates,
  dayDifference,
  daysInMonth,
  endOfWeek,
  formatDe,
  formatDeDateTime,
  isValidCalendarDate,
  isValidTime,
  minutesFromWindowStart,
  nowInBerlin,
  startOfWeek,
  todayInBerlin,
  windowFor,
} from '@/lib/date';

describe('calendar dates as strings', () => {
  it('accepts a leap day in 2028 and rejects it in 2027', () => {
    expect(isValidCalendarDate('2028-02-29')).toBe(true);
    expect(isValidCalendarDate('2027-02-29')).toBe(false);
  });

  it('rejects impossible calendar dates without shifting them', () => {
    expect(isValidCalendarDate('2026-02-31')).toBe(false);
    expect(isValidCalendarDate('2026-04-31')).toBe(false);
    expect(isValidCalendarDate('2026-13-01')).toBe(false);
    expect(isValidCalendarDate('2026-00-10')).toBe(false);
    expect(isValidCalendarDate('2026-11-31')).toBe(false);
    expect(isValidCalendarDate('12.11.2026')).toBe(false);
  });

  it('knows month lengths', () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
    expect(daysInMonth(2026, 13)).toBe(0);
  });

  it('adds days across the 2026 DST weekends without drifting', () => {
    // DST starts 29.03.2026 and ends 25.10.2026 in Europe/Berlin.
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-03-29', -1)).toBe('2026-03-28');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('compares and formats in German notation', () => {
    expect(compareDates('2026-11-10', '2026-11-12')).toBe(-1);
    expect(compareDates('2026-11-12', '2026-11-12')).toBe(0);
    expect(compareDates('2026-11-13', '2026-11-12')).toBe(1);
    expect(formatDe('2026-11-12')).toBe('12.11.2026');
  });

  it('derives Berlin today from a fixed clock', () => {
    expect(todayInBerlin(new Date('2025-12-31T23:30:00Z'))).toBe('2026-01-01');
    expect(todayInBerlin(new Date('2026-11-16T22:59:59Z'))).toBe('2026-11-16');
    expect(todayInBerlin(new Date('2026-11-16T23:30:00Z'))).toBe('2026-11-17');
  });

  it('derives Berlin wall-clock time from a fixed clock', () => {
    expect(nowInBerlin(new Date('2026-07-01T12:34:00Z'))).toEqual({
      date: '2026-07-01',
      time: '14:34',
    });
    expect(nowInBerlin(new Date('2026-01-01T00:05:00Z'))).toEqual({
      date: '2026-01-01',
      time: '01:05',
    });
  });

  it('validates HH:MM times', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('7:05')).toBe(false);
  });
});

describe('week windows', () => {
  it('runs Monday to Sunday around the selected day', () => {
    expect(startOfWeek('2026-11-18')).toBe('2026-11-16');
    expect(endOfWeek('2026-11-18')).toBe('2026-11-22');
    expect(startOfWeek('2026-11-16')).toBe('2026-11-16');
    expect(startOfWeek('2026-11-22')).toBe('2026-11-16');
  });

  it('crosses month and year ends', () => {
    expect(startOfWeek('2026-11-30')).toBe('2026-11-30');
    expect(startOfWeek('2027-01-01')).toBe('2026-12-28');
    expect(endOfWeek('2027-01-01')).toBe('2027-01-03');
  });

  it('handles a leap day and the 2027 clock change', () => {
    expect(startOfWeek('2028-03-01')).toBe('2028-02-28');
    expect(endOfWeek('2028-03-01')).toBe('2028-03-05');
    expect(startOfWeek('2027-03-28')).toBe('2027-03-22');
    expect(endOfWeek('2027-03-28')).toBe('2027-03-28');
  });

  it('labels the day and week windows', () => {
    expect(windowFor('day', '2026-11-14').label).toBe('14.11.2026');
    expect(windowFor('day', '2026-11-14').totalMinutes).toBe(1440);

    const week = windowFor('week', '2026-11-18');
    expect(week.from).toBe('2026-11-16');
    expect(week.to).toBe('2026-11-22');
    expect(week.label).toBe('16.11.2026 – 22.11.2026');
    expect(week.totalMinutes).toBe(10080);
  });

  it('positions entries by date and time within the window', () => {
    expect(minutesFromWindowStart('2026-11-16', '2026-11-18', '09:15')).toBe(3435);
    expect(minutesFromWindowStart('2026-11-16', '2026-11-16', '00:00')).toBe(0);
    expect(dayDifference('2026-11-16', '2026-11-22')).toBe(6);
    expect(formatDeDateTime('2026-11-12', '10:33')).toBe('12.11.2026 10:33');
  });
});
