'use client';

import { buildSeriesSegments, type SeriesPoint } from '@/lib/chart-segments';
import { formatDe } from '@/lib/date';
import type { VitalField } from '@/lib/types';
import { valuesFromRecord } from '@/lib/vitals';
import { useVitalView } from '@/state/vital-view';

const WIDTH = 760;
const HEIGHT = 320;
const PADDING = { top: 24, right: 56, bottom: 34, left: 52 };

const SERIES = [
  { field: 'systolic' as const, label: 'Systolisch', color: '#1d4ed8', axis: 'bp' as const },
  { field: 'diastolic' as const, label: 'Diastolisch', color: '#60a5fa', axis: 'bp' as const },
  { field: 'pulse' as const, label: 'Puls', color: '#dc2626', axis: 'pulse' as const },
];

export function VitalChart() {
  const { windowDates, records, activeDate, hoverDate, selectDate } = useVitalView();

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const step = windowDates.length > 1 ? plotWidth / (windowDates.length - 1) : plotWidth;

  const pointsFor = (field: VitalField): SeriesPoint[] =>
    windowDates
      .map((date) => {
        const record = records[date];
        if (!record) return null;
        const value = valuesFromRecord(record)[field];
        return value === null ? null : { date, value };
      })
      .filter((point): point is SeriesPoint => point !== null);

  const series = SERIES.map((entry) => ({
    ...entry,
    ...buildSeriesSegments(pointsFor(entry.field), windowDates),
  }));

  const bpValues = series
    .filter((entry) => entry.axis === 'bp')
    .flatMap((entry) => entry.markers.map((marker) => marker.value));
  const pulseValues = series
    .filter((entry) => entry.axis === 'pulse')
    .flatMap((entry) => entry.markers.map((marker) => marker.value));

  const bpMax = Math.max(160, Math.ceil(Math.max(0, ...bpValues) / 20) * 20);
  const pulseMax = Math.max(120, Math.ceil(Math.max(0, ...pulseValues) / 20) * 20);

  const xFor = (date: string): number => {
    const index = windowDates.indexOf(date);
    return PADDING.left + index * step;
  };
  const yFor = (value: number, axis: 'bp' | 'pulse'): number =>
    PADDING.top + plotHeight - (value / (axis === 'bp' ? bpMax : pulseMax)) * plotHeight;

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <figure className="w-full">
      <div className="flex flex-wrap items-center gap-4 pb-2 text-xs text-ink-muted">
        {SERIES.map((entry) => (
          <span key={entry.field} className="inline-flex items-center gap-1">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-4 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            {entry.label}
          </span>
        ))}
        <span className="ml-auto">Gestrichelt = Lücke über fehlende Tage</span>
      </div>

      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label={`Vitalwerte vom ${formatDe(windowDates[0] ?? activeDate)} bis ${formatDe(
            windowDates[windowDates.length - 1] ?? activeDate,
          )}: systolischer und diastolischer Blutdruck sowie Puls`}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="min-w-[640px]"
        >
          <rect
            x={PADDING.left}
            y={PADDING.top}
            width={plotWidth}
            height={plotHeight}
            fill="#ffffff"
            stroke="#cbd5e1"
          />

          {ticks.map((fraction) => {
            const y = PADDING.top + plotHeight - fraction * plotHeight;
            return (
              <g key={fraction}>
                <line
                  x1={PADDING.left}
                  x2={PADDING.left + plotWidth}
                  y1={y}
                  y2={y}
                  stroke="#e2e8f0"
                />
                <text x={PADDING.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#475569">
                  {Math.round(bpMax * fraction)}
                </text>
                <text
                  x={PADDING.left + plotWidth + 8}
                  y={y + 4}
                  textAnchor="start"
                  fontSize="10"
                  fill="#475569"
                >
                  {Math.round(pulseMax * fraction)}
                </text>
              </g>
            );
          })}

          <text x={PADDING.left - 40} y={12} fontSize="10" fill="#475569">
            mmHg
          </text>
          <text x={PADDING.left + plotWidth + 4} y={12} fontSize="10" fill="#475569">
            Schläge/min
          </text>

          {windowDates.map((date) => {
            const isActive = date === activeDate;
            const center = xFor(date);
            const left = Math.max(PADDING.left, center - step / 2);
            return (
              <g key={date}>
                <rect
                  data-testid={`band-${date}`}
                  x={left}
                  y={PADDING.top}
                  width={Math.min(step, PADDING.left + plotWidth - left)}
                  height={plotHeight}
                  fill={isActive ? '#dbeafe' : 'transparent'}
                  opacity={isActive ? 0.85 : 0}
                  onPointerEnter={() => hoverDate(date)}
                  onPointerLeave={() => hoverDate(null)}
                  onClick={() => selectDate(date)}
                  className="cursor-pointer"
                />
                <text
                  x={center}
                  y={HEIGHT - 12}
                  textAnchor="middle"
                  fontSize="10"
                  fill={isActive ? '#1d4ed8' : '#475569'}
                  fontWeight={isActive ? 600 : 400}
                >
                  {formatDe(date).slice(0, 5)}
                </text>
              </g>
            );
          })}

          {series.map((entry) => (
            <g key={entry.field}>
              {entry.solid.map(([a, b]) => (
                <line
                  key={`solid-${a.date}-${b.date}`}
                  data-testid="segment-solid"
                  x1={xFor(a.date)}
                  y1={yFor(a.value, entry.axis)}
                  x2={xFor(b.date)}
                  y2={yFor(b.value, entry.axis)}
                  stroke={entry.color}
                  strokeWidth={2}
                />
              ))}
              {entry.dashed.map(([a, b]) => (
                <line
                  key={`dashed-${a.date}-${b.date}`}
                  data-testid="segment-dashed"
                  x1={xFor(a.date)}
                  y1={yFor(a.value, entry.axis)}
                  x2={xFor(b.date)}
                  y2={yFor(b.value, entry.axis)}
                  stroke={entry.color}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                />
              ))}
              {entry.markers.map((marker) => (
                <circle
                  key={`marker-${entry.field}-${marker.date}`}
                  data-testid="marker"
                  cx={xFor(marker.date)}
                  cy={yFor(marker.value, entry.axis)}
                  r={marker.date === activeDate ? 5 : 3.5}
                  fill={entry.color}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
              ))}
            </g>
          ))}
        </svg>
      </div>
    </figure>
  );
}
