// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CareReportList } from '@/components/care-report-list';
import type { CareReport } from '@/lib/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

function report(overrides: Partial<CareReport>): CareReport {
  return {
    id: 'r-1',
    patientId: 'p-1',
    groupId: 'g-1',
    observedDate: '2026-11-16',
    observedTime: '14:30',
    shift: 'spaet',
    body: 'Ruhiger Verlauf.',
    version: 1,
    createdAt: '2026-11-16T13:30:00.000Z',
    updatedAt: '2026-11-16T13:30:00.000Z',
    ...overrides,
  };
}

describe('CareReportList', () => {
  it('renders entries in the order it receives them with shift and time', () => {
    render(
      <CareReportList
        patientId="p-1"
        reports={[
          report({ id: 'r-new', observedTime: '20:00', shift: 'nacht', body: 'Abend.' }),
          report({ id: 'r-old', observedTime: '06:00', shift: 'frueh', body: 'Morgen.' }),
        ]}
      />,
    );

    const items = within(screen.getByTestId('care-report-list')).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('20:00');
    expect(items[0]).toHaveTextContent('Nacht');
    expect(items[1]).toHaveTextContent('Morgen.');
  });

  it('marks an edited report and leaves an unedited one unmarked', () => {
    render(
      <CareReportList
        patientId="p-1"
        reports={[
          report({ id: 'r-edited', version: 3, body: 'Neu gefasst.' }),
          report({ id: 'r-fresh', observedTime: '10:00' }),
        ]}
      />,
    );

    expect(screen.getByText('bearbeitet')).toBeInTheDocument();
    expect(screen.getAllByText('bearbeitet')).toHaveLength(1);
  });

  it('shows earlier versions read-only and without edit controls', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          revisions: [
            {
              id: 'rev-1',
              reportId: 'r-edited',
              version: 1,
              body: 'Erste Fassung.',
              actorType: 'group',
              actorId: 'g-1',
              createdAt: '2026-11-16T13:00:00.000Z',
            },
          ],
        }),
      }),
    );

    const user = userEvent.setup();
    render(<CareReportList patientId="p-1" reports={[report({ id: 'r-edited', version: 2 })]} />);

    await user.click(screen.getByRole('button', { name: 'Verlauf' }));

    const history = await screen.findByTestId('care-report-history');
    expect(history).toHaveTextContent('Erste Fassung.');
    expect(history).toHaveTextContent('Fassung 1');
    expect(within(history).queryAllByRole('button')).toHaveLength(0);
    expect(within(history).queryAllByRole('textbox')).toHaveLength(0);
  });

  it('opens an editor with the current body', async () => {
    const user = userEvent.setup();
    render(<CareReportList patientId="p-1" reports={[report({ body: 'Aktueller Text.' })]} />);

    await user.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    expect(screen.getByLabelText(/Pflegebericht vom 16.11.2026 bearbeiten/)).toHaveValue(
      'Aktueller Text.',
    );
  });

  it('reports an empty list for a patient without reports', () => {
    render(<CareReportList patientId="p-1" reports={[]} />);
    expect(screen.getByText(/noch keine Pflegeberichte/)).toBeInTheDocument();
  });
});
