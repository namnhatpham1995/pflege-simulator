// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/server/auth/session', () => ({
  requireActor: vi.fn().mockRejectedValue(new Error('no session')),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import LoginPage from '@/app/(auth)/login/page';

describe('LoginPage', () => {
  it('offers a way back to the front page', async () => {
    render(await LoginPage());
    expect(screen.getByRole('link', { name: /Zurück zur Startseite/ })).toHaveAttribute('href', '/');
  });
});
