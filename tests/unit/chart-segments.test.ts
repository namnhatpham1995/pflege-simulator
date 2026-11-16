import { describe, expect, it } from 'vitest';
import { buildSeriesSegments, buildWindowDates, type SeriesPoint } from '@/lib/chart-segments';

const windowDates = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];

describe('buildSeriesSegments', () => {
  it('joins adjacent stored values with solid lines', () => {
    const systolic: SeriesPoint[] = [
      { date: '2026-11-10', value: 120 },
      { date: '2026-11-11', value: 125 },
      { date: '2026-11-12', value: 130 },
      { date: '2026-11-13', value: 128 },
    ];
    const segments = buildSeriesSegments(systolic, windowDates);
    expect(segments.solid).toHaveLength(3);
    expect(segments.dashed).toHaveLength(0);
    expect(segments.markers).toHaveLength(4);
  });

  it('draws a dashed segment across a missing date for that series only', () => {
    const diastolic: SeriesPoint[] = [
      { date: '2026-11-10', value: 80 },
      { date: '2026-11-12', value: 85 },
      { date: '2026-11-13', value: 82 },
    ];
    const segments = buildSeriesSegments(diastolic, windowDates);
    expect(segments.dashed).toHaveLength(1);
    expect(segments.dashed[0]?.map((point) => point.date)).toEqual(['2026-11-10', '2026-11-12']);
    expect(segments.solid).toHaveLength(1);
  });

  it('does not let a missing diastolic value interrupt the systolic curve', () => {
    const pulse: SeriesPoint[] = [
      { date: '2026-11-10', value: 72 },
      { date: '2026-11-11', value: 78 },
      { date: '2026-11-13', value: 80 },
    ];
    const segments = buildSeriesSegments(pulse, windowDates);
    expect(segments.solid).toHaveLength(1);
    expect(segments.dashed).toHaveLength(1);
    expect(segments.dashed[0]?.map((point) => point.date)).toEqual(['2026-11-11', '2026-11-13']);
  });

  it('shows a single point as a marker without a line', () => {
    const segments = buildSeriesSegments([{ date: '2026-11-11', value: 72 }], windowDates);
    expect(segments.markers).toHaveLength(1);
    expect(segments.solid).toHaveLength(0);
    expect(segments.dashed).toHaveLength(0);
  });

  it('never fabricates a point for a date without a value', () => {
    const segments = buildSeriesSegments([], windowDates);
    expect(segments.markers).toEqual([]);
    expect(segments.solid).toEqual([]);
    expect(segments.dashed).toEqual([]);
  });

  it('handles leading and trailing gaps inside the window', () => {
    const segments = buildSeriesSegments(
      [
        { date: '2026-11-11', value: 70 },
        { date: '2026-11-12', value: 71 },
      ],
      windowDates,
    );
    expect(segments.markers.map((point) => point.date)).toEqual(['2026-11-11', '2026-11-12']);
    expect(segments.solid).toHaveLength(1);
  });

  it('ignores points outside the visible window', () => {
    const segments = buildSeriesSegments(
      [
        { date: '2026-11-01', value: 60 },
        { date: '2026-11-11', value: 70 },
      ],
      windowDates,
    );
    expect(segments.markers.map((point) => point.date)).toEqual(['2026-11-11']);
    expect(segments.solid).toHaveLength(0);
  });
});

describe('buildWindowDates', () => {
  it('returns a 14-day window centred on the selected date', () => {
    const dates = buildWindowDates('2026-11-16', { before: 7, after: 6 });
    expect(dates).toHaveLength(14);
    expect(dates[0]).toBe('2026-11-09');
    expect(dates[7]).toBe('2026-11-16');
    expect(dates[13]).toBe('2026-11-22');
  });

  it('crosses month boundaries and leap days without drifting', () => {
    const dates = buildWindowDates('2028-03-01', { before: 2, after: 1 });
    expect(dates).toEqual(['2028-02-28', '2028-02-29', '2028-03-01', '2028-03-02']);
  });
});
