// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionTabs } from '@/components/section-tabs';

vi.mock('next/navigation', () => ({
  usePathname: () => '/patients/p-1/pflegebericht',
}));

describe('SectionTabs', () => {
  it('marks the current section and links both areas', () => {
    render(<SectionTabs patientId="p-1" />);

    const vitals = screen.getByRole('link', { name: 'Vitalwerte' });
    const reports = screen.getByRole('link', { name: 'Pflegebericht' });

    expect(vitals).toHaveAttribute('href', '/patients/p-1/vitalwerte');
    expect(reports).toHaveAttribute('href', '/patients/p-1/pflegebericht');
    expect(reports).toHaveAttribute('aria-current', 'page');
    expect(vitals).not.toHaveAttribute('aria-current');
  });
});
