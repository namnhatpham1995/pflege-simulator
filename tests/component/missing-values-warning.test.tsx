// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MissingValuesWarning } from '@/components/missing-values-warning';

describe('MissingValuesWarning', () => {
  it('names the German date and every missing field', () => {
    render(<MissingValuesWarning date="2026-11-12" missing={['pulse', 'temperature', 'pain']} />);
    expect(screen.getByTestId('missing-warning')).toHaveTextContent(
      '12.11.2026: Fehlende Werte: Puls, Temperatur, Schmerzen',
    );
  });

  it('is a polite live region', () => {
    render(<MissingValuesWarning date="2026-11-12" missing={['pulse']} />);
    expect(screen.getByTestId('missing-warning')).toHaveAttribute('aria-live', 'polite');
  });

  it('reports completeness instead of an empty list', () => {
    render(<MissingValuesWarning date="2026-11-12" missing={[]} />);
    expect(screen.getByTestId('missing-warning')).toHaveTextContent(
      'Für 12.11.2026 sind alle erwarteten Werte erfasst.',
    );
  });
});
