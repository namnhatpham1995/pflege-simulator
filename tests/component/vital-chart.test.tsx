// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EntryHoverProvider } from '@/components/entry-hover';
import { VitalChart } from '@/components/vital-chart';
import { makeEntry } from '../helpers/entries';

function renderChart(entries: Parameters<typeof VitalChart>[0]['entries']) {
  return render(
    <EntryHoverProvider>
      <VitalChart entries={entries} from="2026-11-12" totalMinutes={1440} label="12.11.2026" />
    </EntryHoverProvider>,
  );
}

describe('VitalChart', () => {
  it('renders four distinct chart series and their units', () => {
    renderChart([
      makeEntry('s1', 'systolic', 120, '2026-11-12', '08:00'),
      makeEntry('s2', 'systolic', 124, '2026-11-12', '12:00'),
      makeEntry('d1', 'diastolic', 80, '2026-11-12', '08:00'),
      makeEntry('d2', 'diastolic', 82, '2026-11-12', '12:00'),
      makeEntry('p1', 'pulse', 72, '2026-11-12', '08:00'),
      makeEntry('p2', 'pulse', 76, '2026-11-12', '12:00'),
      makeEntry('t1', 'temperature', 36.8, '2026-11-12', '08:00'),
      makeEntry('t2', 'temperature', 37.1, '2026-11-12', '12:00'),
    ]);

    for (const kind of ['systolic', 'diastolic', 'pulse', 'temperature']) {
      expect(screen.getByTestId(`series-line-${kind}`)).toBeInTheDocument();
    }
    expect(screen.getByText('mmHg')).toBeInTheDocument();
    expect(screen.getByText('Schläge/min')).toBeInTheDocument();
    expect(screen.getByText('°C')).toBeInTheDocument();
  });

  it('does not chart weight, height, pain or glucose', () => {
    renderChart([
      makeEntry('w', 'weight', 74),
      makeEntry('h', 'height', 178),
      makeEntry('p', 'pain', 3, '2026-11-12', '10:00'),
      makeEntry('g', 'glucose', 110, '2026-11-12', '11:00'),
    ]);
    expect(screen.queryAllByTestId('marker')).toHaveLength(0);
    expect(screen.queryByTestId('series-line-weight')).not.toBeInTheDocument();
  });

  it('positions two entries on one day at different x coordinates', () => {
    renderChart([
      makeEntry('morning', 'pulse', 70, '2026-11-12', '08:00'),
      makeEntry('afternoon', 'pulse', 84, '2026-11-12', '14:30'),
    ]);

    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(2);
    const xs = markers.map((marker) => Number(marker.getAttribute('cx')));
    expect(xs[0]).not.toBe(xs[1]);
    expect(xs[1]!).toBeGreaterThan(xs[0]!);
  });

  it('joins a multi-day gap with one solid path', () => {
    renderChart([
      makeEntry('mon', 'diastolic', 80, '2026-11-16', '08:00'),
      makeEntry('thu', 'diastolic', 86, '2026-11-19', '08:00'),
    ]);
    const line = screen.getByTestId('series-line-diastolic');
    expect(line.getAttribute('d')).toContain(' L ');
    expect(line).not.toHaveAttribute('stroke-dasharray');
  });

  it('draws no markers or lines for an empty window', () => {
    renderChart([]);
    expect(screen.queryAllByTestId('marker')).toHaveLength(0);
    expect(screen.queryByTestId('series-line-systolic')).not.toBeInTheDocument();
  });
});
