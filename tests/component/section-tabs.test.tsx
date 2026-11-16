// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionTabs } from '@/components/section-tabs';

vi.mock('next/navigation', () => ({
  usePathname: () => '/patients/p-1/vitalwerte',
}));

describe('SectionTabs', () => {
  it('shows exactly the three sections in order', () => {
    render(<SectionTabs patientId="p-1" />);
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Dashboard',
      'Vitalwerte',
      'Pflegebericht',
    ]);
    expect(links[0]).toHaveAttribute('href', '/patients/p-1/dashboard');
    expect(links[1]).toHaveAttribute('href', '/patients/p-1/vitalwerte');
    expect(links[2]).toHaveAttribute('href', '/patients/p-1/pflegebericht');
  });

  it('marks the current tab for assistive technology', () => {
    render(<SectionTabs patientId="p-1" />);
    const vitals = screen.getByRole('link', { name: 'Vitalwerte' });
    expect(vitals).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('keeps every tab keyboard reachable', () => {
    render(<SectionTabs patientId="p-1" />);
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveProperty('tabIndex', 0);
    }
  });
});
