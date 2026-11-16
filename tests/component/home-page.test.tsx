// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';

describe('HomePage', () => {
  it('offers Start as the primary way in', () => {
    render(<HomePage />);
    expect(screen.getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/patients');
  });

  it('keeps the teacher sign-in as a secondary link', () => {
    render(<HomePage />);
    const teacher = screen.getByRole('link', { name: 'Anmeldung für die Lehrkraft' });
    expect(teacher).toHaveAttribute('href', '/login');
    expect(teacher).not.toHaveClass(/bg-accent/);
  });

  it('asks for no access code anywhere', () => {
    render(<HomePage />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Zugangscode/)).not.toBeInTheDocument();
  });
});
