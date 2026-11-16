// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';

describe('ui primitives', () => {
  it('renders a button with its variant and fires onClick', () => {
    const onClick = vi.fn();
    render(
      <Button variant="danger" onClick={onClick}>
        Speichern
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Speichern' });
    expect(button.className).toContain('bg-danger');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders a field label, hint and error', () => {
    const { rerender } = render(
      <Field label="Puls" htmlFor="pulse" hint="Schläge pro Minute">
        <input id="pulse" />
      </Field>,
    );
    expect(screen.getByLabelText('Puls')).toHaveAttribute('id', 'pulse');
    expect(screen.getByText('Schläge pro Minute')).toBeInTheDocument();

    rerender(
      <Field label="Puls" htmlFor="pulse" error="Wert außerhalb des Bereichs">
        <input id="pulse" />
      </Field>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Wert außerhalb des Bereichs');
  });

  it('renders a dialog only while open and closes on Escape', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Dialog open={false} onClose={onClose} title="Tageswert löschen">
        Inhalt
      </Dialog>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <Dialog open onClose={onClose} title="Tageswert löschen">
        Inhalt
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Tageswert löschen');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
