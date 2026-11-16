import type { VitalField } from '@/lib/types';

export interface SeriesPoint {
  entryId: string;
  date: string;
  time: string;
  value: number;
}

export interface Series {
  /** Every stored point in the window, chronological. */
  markers: SeriesPoint[];
  /** The same points when there are at least two; a lone point has no line. */
  path: SeriesPoint[];
}

function chronological(a: SeriesPoint, b: SeriesPoint): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.time !== b.time) return a.time < b.time ? -1 : 1;
  return a.entryId < b.entryId ? -1 : a.entryId > b.entryId ? 1 : 0;
}

/**
 * One series is sorted by date and time and joined with a single solid path.
 * A gap never changes the line style and never touches another series.
 */
export function buildSeries(points: SeriesPoint[]): Series {
  const markers = [...points]
    .filter((point) => Number.isFinite(point.value))
    .sort(chronological);
  return { markers, path: markers.length > 1 ? markers : [] };
}

export interface AxisDefaults {
  min: number;
  max: number;
  step: number;
}

export interface AxisRange {
  min: number;
  max: number;
  ticks: number[];
}

/** Fixed default range, expanded to include an outlier instead of clipping it. */
export function axisRange(values: number[], defaults: AxisDefaults): AxisRange {
  const finite = values.filter((value) => Number.isFinite(value));
  const low = Math.min(defaults.min, ...finite);
  const high = Math.max(defaults.max, ...finite);
  const min = Math.floor(low / defaults.step) * defaults.step;
  const max = Math.ceil(high / defaults.step) * defaults.step;
  const ticks = Array.from({ length: 5 }, (_, index) => min + ((max - min) / 4) * index);
  return { min, max, ticks };
}

export type ChartAxis = 'bp' | 'pulse' | 'temperature';

export interface ChartSeriesDefinition {
  kind: VitalField;
  label: string;
  color: string;
  axis: ChartAxis;
}

export const CHART_SERIES: readonly ChartSeriesDefinition[] = [
  { kind: 'systolic', label: 'Systolisch', color: '#1d4ed8', axis: 'bp' },
  { kind: 'diastolic', label: 'Diastolisch', color: '#60a5fa', axis: 'bp' },
  { kind: 'pulse', label: 'Puls', color: '#dc2626', axis: 'pulse' },
  { kind: 'temperature', label: 'Temperatur', color: '#ea580c', axis: 'temperature' },
];

export const AXIS_DEFAULTS: Record<ChartAxis, AxisDefaults> = {
  bp: { min: 40, max: 200, step: 20 },
  pulse: { min: 40, max: 180, step: 20 },
  temperature: { min: 34, max: 42, step: 1 },
};
