// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MissingValuesWarning } from '@/components/missing-values-warning';
import { VitalsTable } from '@/components/vitals-table';
import { getMissingFields } from '@/lib/missing-value-policy';
import { VitalViewProvider, useVitalView } from '@/state/vital-view';
import { BASE_REQUIREMENTS, makeRecord } from '../helpers/vitals';

function WarningProbe() {
  const { activeDate, activeValues, requirements } = useVitalView();
  return (
    <MissingValuesWarning
      date={activeDate}
      missing={getMissingFields(activeValues, requirements)}
    />
  );
}

function renderWorkspace(initialDate = '2026-11-12') {
  const records = [
    makeRecord('2026-11-10', { systolic: 120, diastolic: 80, pulse: 72 }),
    makeRecord('2026-11-12', { systolic: 130 }),
  ];
  return render(
    <VitalViewProvider
      patientId="p-1"
      initialDate={initialDate}
      initialRecords={records}
      initialRequirements={BASE_REQUIREMENTS}
    >
      <VitalsTable />
      <WarningProbe />
    </VitalViewProvider>,
  );
}

describe('VitalsTable', () => {
  it('highlights the whole selected date column', () => {
    renderWorkspace();
    expect(screen.getByTestId('date-header-2026-11-12')).toHaveClass('bg-accent-soft');
    for (const field of ['systolic', 'diastolic', 'pulse', 'temperature', 'weight', 'height', 'pain', 'glucose']) {
      expect(screen.getByTestId(`cell-2026-11-12-${field}`)).toHaveClass('bg-accent-soft');
    }
    expect(screen.getByTestId('date-header-2026-11-11')).not.toHaveClass('bg-accent-soft');
  });

  it('keeps a missing cell red inside the highlighted column and announces it', () => {
    renderWorkspace();
    const cell = screen.getByTestId('cell-2026-11-12-diastolic');
    expect(cell).toHaveAttribute('data-missing', 'true');
    const button = within(cell).getByRole('button');
    expect(button).toHaveTextContent('Fehlt');
    expect(button.className).toContain('bg-danger-soft');
    expect(button).toHaveAccessibleName(/Blutdruck diastolisch am 2026-11-12 fehlt/);
    expect(screen.getByTestId('missing-warning')).toHaveTextContent(
      '12.11.2026: Fehlende Werte: Blutdruck diastolisch, Puls',
    );
  });

  it('moves the highlight on hover and restores the selection on leave', () => {
    renderWorkspace();
    fireEvent.pointerEnter(screen.getByTestId('date-header-2026-11-13'));
    expect(screen.getByTestId('date-header-2026-11-13')).toHaveClass('bg-accent-soft');
    expect(screen.getByTestId('date-header-2026-11-12')).not.toHaveClass('bg-accent-soft');

    fireEvent.pointerLeave(screen.getByRole('table').parentElement!);
    expect(screen.getByTestId('date-header-2026-11-12')).toHaveClass('bg-accent-soft');
  });

  it('shows a focused editor with the stored value and a distinct outline', async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const cell = screen.getByTestId('cell-2026-11-12-systolic');
    await user.click(within(cell).getByRole('button'));

    const input = within(cell).getByRole('textbox');
    expect(input).toHaveFocus();
    expect(input).toHaveValue('130');
    expect(input.className).toContain('outline-accent');
  });
});
