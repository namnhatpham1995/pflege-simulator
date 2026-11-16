const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function parseParts(value: string): DateParts | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  if (year < 1) return null;
  return { year, month, day };
}

export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 0;
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function toIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isValidCalendarDate(value: string): boolean {
  return parseParts(value) !== null;
}

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function addDays(date: string, delta: number): string {
  const parts = parseParts(date);
  if (!parts) throw new Error(`Ungültiges Datum: ${date}`);
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + delta));
  return shifted.toISOString().slice(0, 10);
}

export function compareDates(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function formatDe(date: string): string {
  const parts = parseParts(date);
  if (!parts) return date;
  return `${String(parts.day).padStart(2, '0')}.${String(parts.month).padStart(2, '0')}.${parts.year}`;
}

export function todayInBerlin(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function nowInBerlin(now: Date = new Date()): { date: string; time: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

export function splitDate(date: string): DateParts {
  const parts = parseParts(date);
  if (!parts) throw new Error(`Ungültiges Datum: ${date}`);
  return parts;
}
