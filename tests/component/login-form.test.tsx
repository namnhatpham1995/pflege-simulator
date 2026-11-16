// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/components/login-form';

const replace = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}));

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
  vi.unstubAllGlobals();
});

describe('LoginForm', () => {
  it('offers one password field and no access-code mode', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/Passwort der Lehrkraft/)).toHaveAttribute('type', 'password');
    expect(screen.queryByLabelText(/Zugangscode/)).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeDisabled();
  });

  it('shows one generic message for a refused login', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Das Passwort ist falsch.' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText(/Passwort der Lehrkraft/), 'falsch');
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Das Passwort ist falsch.');
    expect(replace).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('disables the submit button while the request is pending', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => undefined)));

    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText(/Passwort der Lehrkraft/), 'geheim');
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Anmeldung läuft…' })).toBeDisabled();
    });
  });

  it('opens the teacher console after a successful login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ actor: { type: 'teacher' } }) }),
    );

    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText(/Passwort der Lehrkraft/), 'geheim');
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/teacher'));
  });
});
