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
  it('renders the group mode with a required access-code field', () => {
    render(<LoginForm />);
    const input = screen.getByLabelText(/Zugangscode der Gruppe/);
    expect(input).toBeRequired();
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeDisabled();
  });

  it('switches to teacher mode and shows a password field', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.click(screen.getByRole('tab', { name: 'Lehrkraft' }));
    expect(screen.getByLabelText(/Passwort der Lehrkraft/)).toHaveAttribute('type', 'password');
  });

  it('shows the server message for a refused login', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Zugangscode oder Passwort ist falsch.' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText(/Zugangscode der Gruppe/), 'ABCD');
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Zugangscode oder Passwort ist falsch.',
    );
    expect(replace).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('disables the submit button while the request is pending', async () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => undefined));
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText(/Zugangscode der Gruppe/), 'ABCD');
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Anmeldung läuft…' })).toBeDisabled();
    });
  });

  it('navigates to the patient list after a successful login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ actor: { type: 'group' } }) }),
    );

    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText(/Zugangscode der Gruppe/), 'ABCD');
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/patients'));
  });
});
