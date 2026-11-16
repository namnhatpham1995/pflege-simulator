// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatientDetailsDialog } from '@/components/patient-details-dialog';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

beforeEach(() => {
  refresh.mockReset();
  vi.unstubAllGlobals();
});

describe('PatientDetailsDialog', () => {
  it('shows both date-of-birth states', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <PatientDetailsDialog patient={{ id: 'p-1', displayName: 'Frau Albrecht', dateOfBirth: null }} />,
    );
    await user.click(screen.getByRole('button', { name: 'Patientendaten bearbeiten' }));
    expect(screen.getByText('Geburtsdatum nicht angegeben')).toBeInTheDocument();
    unmount();

    render(
      <PatientDetailsDialog
        patient={{ id: 'p-1', displayName: 'Frau Albrecht', dateOfBirth: '1948-03-07' }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Patientendaten bearbeiten' }));
    expect(screen.getByText('Gespeichert: 07.03.1948')).toBeInTheDocument();
  });

  it('shows field-level errors from the server and writes nothing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Ungültig.', fields: { displayName: 'Bitte einen Namen eingeben.' } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(
      <PatientDetailsDialog patient={{ id: 'p-1', displayName: 'Frau Albrecht', dateOfBirth: null }} />,
    );
    await user.click(screen.getByRole('button', { name: 'Patientendaten bearbeiten' }));
    await user.clear(screen.getByLabelText(/Name/));
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('Bitte einen Namen eingeben.')).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('saves a new name and a date of birth', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        patient: { id: 'p-1', displayName: 'Herr Berger', dateOfBirth: '1948-03-07' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(
      <PatientDetailsDialog patient={{ id: 'p-1', displayName: 'Frau Albrecht', dateOfBirth: null }} />,
    );
    await user.click(screen.getByRole('button', { name: 'Patientendaten bearbeiten' }));
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Herr Berger' } });
    fireEvent.click(screen.getByRole('button', { name: 'Geburtsdatum festlegen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/patients/p-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body);
    expect(body).toEqual({ displayName: 'Herr Berger', dateOfBirth: '1950-01-01' });
  });

  it('clears an existing date of birth', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ patient: { id: 'p-1', displayName: 'Frau Albrecht', dateOfBirth: null } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(
      <PatientDetailsDialog
        patient={{ id: 'p-1', displayName: 'Frau Albrecht', dateOfBirth: '1948-03-07' }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Patientendaten bearbeiten' }));
    await user.click(screen.getByRole('button', { name: 'Geburtsdatum löschen' }));
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body);
    expect(body.dateOfBirth).toBeNull();
  });
});
