'use client';

import { useEntryHover } from '@/components/entry-hover';
import {
  AXIS_DEFAULTS,
  CHART_SERIES,
  axisRange,
  buildSeries,
  type ChartAxis,
  type SeriesPoint,
} from '@/lib/chart-segments';
import { addDays, formatDe, minutesFromWindowStart } from '@/lib/date';
import type { VitalEntry } from '@/lib/types';

const WIDTH = 920;
const HEIGHT = 360;
const PADDING = { top: 34, right: 116, bottom: 38, left: 56 };

export interface VitalChartProps {
  entries: VitalEntry[];
  from: string;
  totalMinutes: number;
  label: string;
}

export function VitalChart({ entries, from, totalMinutes, label }: VitalChartProps) {
  const { hoveredIds } = useEntryHover();

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const series = CHART_SERIES.map((definition) => {
    const points: SeriesPoint[] = entries
      .filter((entry) => entry.kind === definition.kind)
      .map((entry) => ({
        entryId: entry.id,
        date: entry.observedDate,
        time: entry.observedTime,
        value: entry.value,
      }));
    return { definition, ...buildSeries(points) };
  });

  const valuesFor = (axis: ChartAxis): number[] =>
    series
      .filter((entry) => entry.definition.axis === axis)
      .flatMap((entry) => entry.markers.map((marker) => marker.value));

  const axes: Record<ChartAxis, ReturnType<typeof axisRange>> = {
    bp: axisRange(valuesFor('bp'), AXIS_DEFAULTS.bp),
    pulse: axisRange(valuesFor('pulse'), AXIS_DEFAULTS.pulse),
    temperature: axisRange(valuesFor('temperature'), AXIS_DEFAULTS.temperature),
  };

  const xFor = (minutes: number): number =>
    PADDING.left + (Math.min(Math.max(minutes, 0), totalMinutes) / totalMinutes) * plotWidth;
  const yFor = (value: number, axis: ChartAxis): number => {
    const range = axes[axis];
    return PADDING.top + plotHeight - ((value - range.min) / (range.max - range.min)) * plotHeight;
  };
  const pointPosition = (point: SeriesPoint, axis: ChartAxis): { x: number; y: number } => ({
    x: xFor(minutesFromWindowStart(from, point.date, point.time)),
    y: yFor(point.value, axis),
  });

  const dayCount = Math.round(totalMinutes / 1440);
  const xTicks =
    dayCount === 1
      ? [0, 360, 720, 1080, 1440]
      : Array.from({ length: dayCount }, (_, index) => index * 1440);

  const lastDate = addDays(from, dayCount - 1);

  return (
    <figure className="w-full" data-testid="vital-chart">
      <div className="flex flex-wrap items-center gap-4 pb-2 text-xs text-ink-muted">
        {CHART_SERIES.map((definition) => (
          <span
            key={definition.kind}
            data-series-legend={definition.kind}
            className="inline-flex items-center gap-1"
          >
            <span
              aria-hidden="true"
              className="inline-block h-2 w-4 rounded-sm"
              style={{ backgroundColor: definition.color }}
            />
            {definition.label}
          </span>
        ))}
        <span className="ml-auto">{label}</span>
      </div>

      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label={`Verlauf vom ${formatDe(from)} bis ${formatDe(lastDate)}: systolischer und diastolischer Blutdruck, Puls und Temperatur`}
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

          {axes.bp.ticks.map((value, index) => {
            const y = yFor(value, 'bp');
            return (
              <g key={`grid-${index}`}>
                <line
                  x1={PADDING.left}
                  x2={PADDING.left + plotWidth}
                  y1={y}
                  y2={y}
                  stroke="#e2e8f0"
                />
                <text x={PADDING.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#475569">
                  {Math.round(value)}
                </text>
                <text
                  x={PADDING.left + plotWidth + 8}
                  y={y + 4}
                  textAnchor="start"
                  fontSize="10"
                  fill="#475569"
                >
                  {Math.round(axes.pulse.min + (index / (axes.bp.ticks.length - 1)) * (axes.pulse.max - axes.pulse.min))}
                </text>
              </g>
            );
          })}

          <text x={PADDING.left - 44} y={18} fontSize="10" fill="#475569">
            mmHg
          </text>
          <text x={PADDING.left + plotWidth + 4} y={18} fontSize="10" fill="#475569">
            Schläge/min
          </text>
          <text x={PADDING.left + plotWidth + 64} y={18} fontSize="10" fill="#ea580c">
            °C
          </text>
          <text
            x={PADDING.left + plotWidth + 64}
            y={PADDING.top + plotHeight}
            fontSize="10"
            fill="#ea580c"
          >
            {axes.temperature.min}
          </text>
          <text x={PADDING.left + plotWidth + 64} y={PADDING.top + 8} fontSize="10" fill="#ea580c">
            {axes.temperature.max}
          </text>

          {xTicks.map((minutes) => {
            const x = xFor(minutes);
            const dayIndex = Math.round(minutes / 1440);
            return (
              <g key={`tick-${minutes}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={PADDING.top}
                  y2={PADDING.top + plotHeight}
                  stroke="#f1f5f9"
                />
                <text
                  x={x}
                  y={HEIGHT - 14}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#475569"
                >
                  {dayCount === 1
                    ? `${String(Math.floor(minutes / 60)).padStart(2, '0')}:00`
                    : formatDe(addDays(from, dayIndex)).slice(0, 5)}
                </text>
              </g>
            );
          })}

          {series.map((entry) => (
            <g key={entry.definition.kind} data-series={entry.definition.kind}>
              {entry.path.length > 1 ? (
                <path
                  data-testid={`series-line-${entry.definition.kind}`}
                  d={entry.path
                    .map((point, index) => {
                      const { x, y } = pointPosition(point, entry.definition.axis);
                      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke={entry.definition.color}
                  strokeWidth={2}
                />
              ) : null}
              {entry.markers.map((marker) => {
                const { x, y } = pointPosition(marker, entry.definition.axis);
                const highlighted = hoveredIds.includes(marker.entryId);
                return (
                  <circle
                    key={marker.entryId}
                    data-testid="marker"
                    data-kind={entry.definition.kind}
                    data-entry-id={marker.entryId}
                    data-highlighted={highlighted ? 'true' : undefined}
                    cx={x}
                    cy={y}
                    r={highlighted ? 6 : 3.5}
                    fill={entry.definition.color}
                    stroke={highlighted ? '#0f172a' : '#ffffff'}
                    strokeWidth={highlighted ? 2 : 1.5}
                  />
                );
              })}
            </g>
          ))}
        </svg>
      </div>
    </figure>
  );
}
