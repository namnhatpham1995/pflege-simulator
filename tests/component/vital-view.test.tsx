// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VitalsTable } from '@/components/vitals-table';
import { VitalViewProvider, useVitalView } from '@/state/vital-view';
import { BASE_REQUIREMENTS, makeRecord } from '../helpers/vitals';

function Probe() {
  const { activeDate, selectedDate, hoveredDate, pending, error } = useVitalView();
  return (
    <div>
      <output data-testid="active">{activeDate}</output>
      <output data-testid="selected">{selectedDate}</output>
      <output data-testid="hovered">{hoveredDate ?? '—'}</output>
      <output data-testid="pending">{String(pending)}</output>
      <output data-testid="error">{error ?? '—'}</output>
    </div>
  );
}

function renderView(initialDate = '2026-11-12') {
  return render(
    <VitalViewProvider
      patientId="p-1"
      initialDate={initialDate}
      initialRecords={[makeRecord('2026-11-12', { systolic: 130, diastolic: 88, pulse: 74 })]}
      initialRequirements={BASE_REQUIREMENTS}
    >
      <Probe />
      <VitalsTable />
    </VitalViewProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('VitalViewProvider', () => {
  it('uses hoveredDate ?? selectedDate as the active date', () => {
    renderView();
    expect(screen.getByTestId('active')).toHaveTextContent('2026-11-12');

    fireEvent.pointerEnter(screen.getByTestId('date-header-2026-11-14'));
    expect(screen.getByTestId('active')).toHaveTextContent('2026-11-14');
    expect(screen.getByTestId('selected')).toHaveTextContent('2026-11-12');

    fireEvent.pointerLeave(screen.getByRole('table').parentElement!);
    expect(screen.getByTestId('hovered')).toHaveTextContent('—');
    expect(screen.getByTestId('active')).toHaveTextContent('2026-11-12');
  });

  it('fetches the new 14-day window when the date is selected', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ records: [], requirements: BASE_REQUIREMENTS }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole('button', { name: '16.11' }));

    expect(screen.getByTestId('selected')).toHaveTextContent('2026-11-16');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/patients/p-1/vitals?from=2026-11-09&to=2026-11-22',
    );
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent('false'));
  });

  it('keeps the typed value when a save is refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { code: 'INTERNAL', message: 'Fehler' } }),
      }),
    );

    const user = userEvent.setup();
    renderView();

    const cell = screen.getByTestId('cell-2026-11-12-pulse');
    await user.click(cell.querySelector('button')!);
    const input = cell.querySelector('input')!;
    await user.clear(input);
    await user.type(input, '99');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByText('Nicht gespeichert.')).toBeInTheDocument());
    expect(cell.querySelector('input')).toHaveValue('99');
    expect(screen.getByTestId('error')).toHaveTextContent(
      'Der Wert konnte nicht gespeichert werden.',
    );
  });
});
