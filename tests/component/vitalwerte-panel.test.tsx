// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VitalwertePanel } from '@/components/vitalwerte-panel';
import type { EntryGroup, RecentEntries } from '@/lib/types';
import { emptyRecentEntries } from '@/lib/vitals';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

function recentWith(category: keyof RecentEntries, groups: EntryGroup[]): RecentEntries {
  const recent = emptyRecentEntries();
  recent[category] = groups;
  return recent;
}

const bloodPressureGroup: EntryGroup = {
  submissionId: 'bp-1',
  category: 'blutdruck',
  observedDate: '2026-11-12',
  observedTime: '08:00',
  values: { systolic: 120, diastolic: 80 },
  createdAt: '2026-11-12T08:00:00.000Z',
};

const pulseGroup: EntryGroup = {
  submissionId: 'pulse-1',
  category: 'puls',
  observedDate: '2026-11-12',
  observedTime: '09:15',
  values: { pulse: 82 },
  createdAt: '2026-11-12T09:15:00.000Z',
};

beforeEach(() => {
  refresh.mockReset();
  vi.unstubAllGlobals();
});

describe('VitalwertePanel', () => {
  it('shows seven category tabs with Blutdruck selected and two inputs', () => {
    render(<VitalwertePanel patientId="p-1" recent={emptyRecentEntries()} canWrite />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Blutdruck',
      'Puls',
      'Temperatur',
      'Gewicht',
      'Größe',
      'Schmerzen',
      'Blutzucker',
    ]);
    expect(screen.getByRole('tab', { name: 'Blutdruck' })).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelector('#entry-systolic')).toBeInTheDocument();
    expect(document.querySelector('#entry-diastolic')).toBeInTheDocument();
    expect(document.querySelector('#entry-pulse')).not.toBeInTheDocument();
  });

  it('shows exactly one value input for a single-value category', async () => {
    const user = userEvent.setup();
    render(<VitalwertePanel patientId="p-1" recent={emptyRecentEntries()} canWrite />);
    await user.click(screen.getByRole('tab', { name: 'Gewicht' }));

    expect(document.querySelector('#entry-weight')).toBeInTheDocument();
    expect(
      document.querySelectorAll('form input[id^="entry-"]:not(#entry-time)'),
    ).toHaveLength(1);
  });

  it('defaults day and time to the current Berlin moment', () => {
    render(<VitalwertePanel patientId="p-1" recent={emptyRecentEntries()} canWrite />);
    const tag = screen.getByLabelText('Tag', { exact: true, selector: 'input' }) as HTMLInputElement;
    const month = screen.getByLabelText('Monat', { exact: true, selector: 'input' }) as HTMLInputElement;
    const year = screen.getByLabelText('Jahr', { exact: true, selector: 'input' }) as HTMLInputElement;
    const time = screen.getByLabelText(/Uhrzeit/) as HTMLInputElement;

    expect(tag.value).toMatch(/^\d{2}$/);
    expect(month.value).toMatch(/^\d{2}$/);
    expect(year.value).toMatch(/^\d{4}$/);
    expect(time.value).toMatch(/^\d{2}:\d{2}$/);
  });

  it('stores nothing while typing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<VitalwertePanel patientId="p-1" recent={emptyRecentEntries()} canWrite />);

    await user.type(document.querySelector('#entry-systolic') as HTMLInputElement, '120');
    await user.tab();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the typed values and shows field errors when the save fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: { message: 'Die Eingaben sind ungültig.', fields: { diastolic: 'Bitte einen Wert eingeben.' } },
        }),
      }),
    );
    const user = userEvent.setup();
    render(<VitalwertePanel patientId="p-1" recent={emptyRecentEntries()} canWrite />);

    await user.type(document.querySelector('#entry-systolic') as HTMLInputElement, '120');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('Bitte einen Wert eingeben.')).toBeInTheDocument();
    expect((document.querySelector('#entry-systolic') as HTMLInputElement).value).toBe('120');
  });

  it('shows a server-confirmed entry, clears the values and resets the defaults', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ entries: [], groups: [pulseGroup] }),
      }),
    );
    const user = userEvent.setup();
    render(<VitalwertePanel patientId="p-1" recent={emptyRecentEntries()} canWrite />);

    await user.click(screen.getByRole('tab', { name: 'Puls' }));
    const input = document.querySelector('#entry-pulse') as HTMLInputElement;
    await user.type(input, '82');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('Gespeichert.')).toBeInTheDocument();
    expect(screen.getByText(/Puls: 82 Schläge\/min/)).toBeInTheDocument();
    expect(input.value).toBe('');
    expect(refresh).toHaveBeenCalled();
  });

  it('lists recent entries newest first and deletes only after confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ deleted: 1 }) });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(
      <VitalwertePanel patientId="p-1" recent={recentWith('puls', [pulseGroup])} canWrite />,
    );
    await user.click(screen.getByRole('tab', { name: 'Puls' }));

    await user.click(screen.getByRole('button', { name: /Eintrag vom 12\.11\.2026 09:15 löschen/ }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.getByText(/Puls: 82 Schläge\/min/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Eintrag vom 12\.11\.2026 09:15 löschen/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Löschen' }));

    await waitFor(() => {
      expect(screen.queryByText(/Puls: 82 Schläge\/min/)).not.toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/patients/p-1/vitals/pulse-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('offers no edit control for a saved entry', async () => {
    const user = userEvent.setup();
    render(
      <VitalwertePanel patientId="p-1" recent={recentWith('blutdruck', [bloodPressureGroup])} canWrite />,
    );
    await user.click(screen.getByRole('tab', { name: 'Blutdruck' }));
    expect(screen.queryByRole('button', { name: /Bearbeiten/ })).not.toBeInTheDocument();
  });

  it('gives the teacher the list without a form or delete buttons', async () => {
    const user = userEvent.setup();
    render(
      <VitalwertePanel patientId="p-1" recent={recentWith('puls', [pulseGroup])} canWrite={false} />,
    );
    await user.click(screen.getByRole('tab', { name: 'Puls' }));

    expect(screen.queryByRole('button', { name: 'Speichern' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /löschen/ })).not.toBeInTheDocument();
    expect(screen.getByText(/nur lesenden Zugriff/)).toBeInTheDocument();
    expect(screen.getByText(/Puls: 82 Schläge\/min/)).toBeInTheDocument();
  });

  it('does not fire a request when the dialog is dismissed by its close button', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(
      <VitalwertePanel patientId="p-1" recent={recentWith('puls', [pulseGroup])} canWrite />,
    );
    await user.click(screen.getByRole('tab', { name: 'Puls' }));
    fireEvent.click(screen.getByRole('button', { name: /Eintrag vom 12\.11\.2026 09:15 löschen/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Schließen' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
