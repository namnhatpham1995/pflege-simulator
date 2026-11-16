// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpectedFieldsEditor, ResetClassDataButton } from '@/components/expected-fields-editor';
import type { Requirements } from '@/lib/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const initial: Requirements = {
  systolic: true,
  diastolic: true,
  pulse: true,
  temperature: false,
  weight: false,
  height: false,
  pain: false,
  glucose: false,
};

describe('ExpectedFieldsEditor', () => {
  it('renders all eight switches with the server state', () => {
    render(<ExpectedFieldsEditor patientId="p-1" initialRequirements={initial} />);

    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(8);
    expect(screen.getByRole('switch', { name: /Puls als erwartet/ })).toBeChecked();
    expect(screen.getByRole('switch', { name: /Temperatur als erwartet/ })).not.toBeChecked();
  });

  it('uses the returned policy rather than the click when the server normalises it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ requirements: { ...initial, temperature: false } }),
      }),
    );

    const user = userEvent.setup();
    render(<ExpectedFieldsEditor patientId="p-1" initialRequirements={initial} />);
    await user.click(screen.getByRole('switch', { name: /Temperatur als erwartet/ }));

    await waitFor(() =>
      expect(screen.getByRole('switch', { name: /Temperatur als erwartet/ })).not.toBeChecked(),
    );
    expect(fetch).toHaveBeenCalledWith(
      '/api/patients/p-1/requirements',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ field: 'temperature', expected: true }) }),
    );
  });

  it('keeps the previous state and reports a refused change', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));

    const user = userEvent.setup();
    render(<ExpectedFieldsEditor patientId="p-1" initialRequirements={initial} />);
    await user.click(screen.getByRole('switch', { name: /Puls als erwartet/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('konnte nicht gespeichert werden');
    expect(screen.getByRole('switch', { name: /Puls als erwartet/ })).toBeChecked();
  });
});

describe('ResetClassDataButton', () => {
  it('posts the confirmation and shows the counts', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ deleted: { vitals: 4, reports: 2, revisions: 1, audit: 9 } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    render(<ResetClassDataButton />);
    await user.click(screen.getByRole('button', { name: 'Klassendaten zurücksetzen' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/reset-class-data',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ confirm: 'RESET' }) }),
    );
    expect(await screen.findByText(/4 Vitalwerte, 2 Pflegeberichte, 1 Fassungen/)).toBeInTheDocument();
  });

  it('does nothing when the confirmation dialog is cancelled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const user = userEvent.setup();
    render(<ResetClassDataButton />);
    await user.click(screen.getByRole('button', { name: 'Klassendaten zurücksetzen' }));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
