import { describe, expect, it } from 'vitest';
import { AXIS_DEFAULTS, axisRange, buildSeries, type SeriesPoint } from '@/lib/chart-segments';

function point(entryId: string, date: string, time: string, value: number): SeriesPoint {
  return { entryId, date, time, value };
}

describe('buildSeries', () => {
  it('sorts points by date and time, then joins them with one path', () => {
    const series = buildSeries([
      point('c', '2026-11-12', '14:30', 80),
      point('a', '2026-11-12', '08:00', 70),
      point('b', '2026-11-12', '10:00', 75),
    ]);

    expect(series.markers.map((marker) => marker.entryId)).toEqual(['a', 'b', 'c']);
    expect(series.path).toHaveLength(3);
  });

  it('joins entries across days with a solid path, with no gap classification', () => {
    const series = buildSeries([
      point('mon', '2026-11-16', '08:00', 70),
      point('thu', '2026-11-19', '08:00', 76),
    ]);

    expect(series.path.map((marker) => marker.entryId)).toEqual(['mon', 'thu']);
    expect('dashed' in series).toBe(false);
  });

  it('keeps a lone entry as a marker without a line', () => {
    const series = buildSeries([point('only', '2026-11-16', '09:15', 36.8)]);
    expect(series.markers).toHaveLength(1);
    expect(series.path).toHaveLength(0);
  });

  it('keeps equal times in creation order and ignores non-finite values', () => {
    const series = buildSeries([
      point('a', '2026-11-16', '09:15', 70),
      point('b', '2026-11-16', '09:15', 72),
      point('bad', '2026-11-16', '10:00', Number.NaN),
    ]);

    expect(series.markers.map((marker) => marker.entryId)).toEqual(['a', 'b']);
  });

  it('builds each kind independently', () => {
    const systolic = buildSeries([point('s1', '2026-11-16', '08:00', 120)]);
    const diastolic = buildSeries([point('d1', '2026-11-16', '09:00', 80)]);

    expect(systolic.markers).toHaveLength(1);
    expect(diastolic.markers).toHaveLength(1);
    expect(systolic.path).toHaveLength(0);
    expect(diastolic.path).toHaveLength(0);
  });
});

describe('axisRange', () => {
  it('keeps the default range when every value fits', () => {
    expect(axisRange([120, 80], AXIS_DEFAULTS.bp)).toEqual({ min: 40, max: 200, ticks: [40, 80, 120, 160, 200] });
  });

  it('expands to include an outlier instead of clipping it', () => {
    const high = axisRange([260], AXIS_DEFAULTS.bp);
    expect(high.max).toBeGreaterThanOrEqual(260);

    const low = axisRange([10], AXIS_DEFAULTS.bp);
    expect(low.min).toBeLessThanOrEqual(10);
  });

  it('returns the defaults for an empty series', () => {
    expect(axisRange([], AXIS_DEFAULTS.temperature)).toEqual({
      min: 34,
      max: 42,
      ticks: [34, 36, 38, 40, 42],
    });
  });
});
