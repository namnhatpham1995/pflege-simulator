// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VitalChart } from '@/components/vital-chart';
import { VitalViewProvider } from '@/state/vital-view';
import { BASE_REQUIREMENTS, makeRecord } from '../helpers/vitals';

function renderChart() {
  const records = [
    makeRecord('2026-11-10', { systolic: 120, diastolic: 80, pulse: 72 }),
    makeRecord('2026-11-11', { systolic: 125, pulse: 78 }),
    makeRecord('2026-11-12', { systolic: 130, diastolic: 85 }),
    makeRecord('2026-11-13', { systolic: 128, diastolic: 82, pulse: 80 }),
  ];
  return render(
    <VitalViewProvider
      patientId="p-1"
      initialDate="2026-11-11"
      initialRecords={records}
      initialRequirements={BASE_REQUIREMENTS}
    >
      <VitalChart />
    </VitalViewProvider>,
  );
}

describe('VitalChart', () => {
  it('renders exactly three series with a marker per stored value', () => {
    renderChart();
    // systolic 4 + diastolic 3 + pulse 3
    expect(screen.getAllByTestId('marker')).toHaveLength(10);
    expect(screen.getByText('Systolisch')).toBeInTheDocument();
    expect(screen.getByText('Diastolisch')).toBeInTheDocument();
    expect(screen.getByText('Puls')).toBeInTheDocument();
  });

  it('dashes only the segments that cross a missing date', () => {
    renderChart();
    expect(screen.getAllByTestId('segment-dashed')).toHaveLength(2);
    expect(screen.getAllByTestId('segment-solid')).toHaveLength(5);
  });

  it('labels both units explicitly', () => {
    renderChart();
    expect(screen.getByText('mmHg')).toBeInTheDocument();
    expect(screen.getByText('Schläge/min')).toBeInTheDocument();
  });

  it('offers one pointer band per visible date', () => {
    renderChart();
    expect(screen.getByTestId('band-2026-11-04')).toBeInTheDocument();
    expect(screen.getByTestId('band-2026-11-17')).toBeInTheDocument();
  });
});
