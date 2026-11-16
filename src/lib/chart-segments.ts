export interface SeriesPoint {
  date: string;
  value: number;
}

export interface SeriesSegments {
  markers: SeriesPoint[];
  solid: [SeriesPoint, SeriesPoint][];
  dashed: [SeriesPoint, SeriesPoint][];
}

/**
 * The whole line-style rule, per series and independent of every other series:
 * adjacent calendar dates are joined solid, one or more missing dates make the
 * segment dashed, a lone point stays a marker and nothing is invented for a day
 * without a stored value.
 */
export function buildSeriesSegments(
  points: SeriesPoint[],
  windowDates: string[],
): SeriesSegments {
  const position = new Map(windowDates.map((date, index) => [date, index]));

  const markers = points
    .filter((point) => position.has(point.date) && Number.isFinite(point.value))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const solid: [SeriesPoint, SeriesPoint][] = [];
  const dashed: [SeriesPoint, SeriesPoint][] = [];

  for (let index = 1; index < markers.length; index += 1) {
    const previous = markers[index - 1]!;
    const current = markers[index]!;
    const gap = position.get(current.date)! - position.get(previous.date)!;
    if (gap === 1) {
      solid.push([previous, current]);
    } else if (gap > 1) {
      dashed.push([previous, current]);
    }
  }

  return { markers, solid, dashed };
}

export interface WindowDatesOptions {
  before: number;
  after: number;
}

export function buildWindowDates(center: string, options: WindowDatesOptions): string[] {
  const { before, after } = options;
  const [year, month, day] = center.split('-').map(Number) as [number, number, number];
  const centerUtc = Date.UTC(year, month - 1, day);
  const dates: string[] = [];
  for (let offset = -before; offset <= after; offset += 1) {
    dates.push(new Date(centerUtc + offset * 86_400_000).toISOString().slice(0, 10));
  }
  return dates;
}
