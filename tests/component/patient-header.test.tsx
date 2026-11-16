// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PatientHeader } from '@/components/patient-header';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

describe('PatientHeader', () => {
  it('shows the name and the formatted date of birth', () => {
    render(
      <PatientHeader
        patient={{ id: 'p-1', displayName: 'Frau Albrecht', dateOfBirth: '1948-03-07' }}
        canEdit={false}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Frau Albrecht' })).toBeInTheDocument();
    expect(screen.getByText('Geburtsdatum: 07.03.1948')).toBeInTheDocument();
  });

  it('states that no date of birth is stored', () => {
    render(
      <PatientHeader
        patient={{ id: 'p-1', displayName: 'Frau Albrecht', dateOfBirth: null }}
        canEdit={false}
      />,
    );
    expect(screen.getByText('Geburtsdatum nicht angegeben')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Patientendaten bearbeiten' })).not.toBeInTheDocument();
  });

  it('offers the edit dialog only to the teacher', () => {
    render(
      <PatientHeader
        patient={{ id: 'p-1', displayName: 'Frau Albrecht', dateOfBirth: null }}
        canEdit
      />,
    );
    expect(screen.getByRole('button', { name: 'Patientendaten bearbeiten' })).toBeInTheDocument();
  });
});
