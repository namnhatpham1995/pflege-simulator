// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CareReportForm } from '@/components/care-report-form';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  refresh.mockReset();
});

async function fillAndSubmit(text: string) {
  const user = userEvent.setup();
  render(<CareReportForm patientId="p-1" defaultDate="2026-11-16" defaultTime="14:30" />);
  await user.type(screen.getByLabelText(/Pflegebericht/), text);
  await user.click(screen.getByRole('button', { name: 'Bericht speichern' }));
  return user;
}

describe('CareReportForm', () => {
  it('prefills date and time and shows the character counter', async () => {
    const user = userEvent.setup();
    render(<CareReportForm patientId="p-1" defaultDate="2026-11-16" defaultTime="14:30" />);

    expect(screen.getByLabelText(/Datum/)).toHaveValue('2026-11-16');
    expect(screen.getByLabelText(/Uhrzeit/)).toHaveValue('14:30');
    expect(screen.getByText('0 / 10000 Zeichen')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Pflegebericht/), 'Kurz.');
    expect(screen.getByText('5 / 10000 Zeichen')).toBeInTheDocument();
  });

  it('keeps the text and shows the server error when the save is refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Ungültig', fields: { body: 'Bitte einen Bericht eingeben.' } } }),
      }),
    );

    await fillAndSubmit('Wichtiger Text');

    expect(await screen.findByRole('alert')).toHaveTextContent('Bitte einen Bericht eingeben.');
    expect(screen.getByLabelText(/Pflegebericht/)).toHaveValue('Wichtiger Text');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('clears the field and confirms after a successful save', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ report: { id: 'r-1' } }) }),
    );

    await fillAndSubmit('Gespeicherter Text');

    expect(await screen.findByText('Der Pflegebericht wurde gespeichert.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Pflegebericht/)).toHaveValue('');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('posts the shift and the wall-clock time', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ report: {} }) });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<CareReportForm patientId="p-1" defaultDate="2026-11-16" defaultTime="14:30" />);
    await user.selectOptions(screen.getByLabelText(/Schicht/), 'nacht');
    await user.type(screen.getByLabelText(/Pflegebericht/), 'Nachtwache.');
    await user.click(screen.getByRole('button', { name: 'Bericht speichern' }));

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body).toMatchObject({
      observedDate: '2026-11-16',
      observedTime: '14:30',
      shift: 'nacht',
      body: 'Nachtwache.',
    });
  });
});
