// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { DashboardPanels } from '@/components/dashboard-panels';
import { makeEntry } from '../helpers/entries';

const entries = [
  makeEntry('weight-1', 'weight', 12, '2026-11-12', '10:33'),
  makeEntry('weight-2', 'weight', 13, '2026-11-12', '11:00'),
  makeEntry('pulse-1', 'pulse', 82, '2026-11-12', '09:15'),
  makeEntry('glucose-1', 'glucose', 110, '2026-11-12', '12:00'),
];

function renderPanels() {
  render(
    <DashboardPanels entries={entries} from="2026-11-12" totalMinutes={1440} label="12.11.2026" />,
  );
}

describe('EntryRows', () => {
  it('shows two weights in chronological order', () => {
    renderPanels();
    const row = screen.getByTestId('entry-row-weight');
    const boxes = within(row).getAllByRole('button');
    expect(boxes.map((box) => box.textContent)).toEqual(['12', '13']);
  });

  it('shows the date and time tooltip on hover and removes it on leave', () => {
    renderPanels();
    const box = screen.getByRole('button', { name: /Gewicht 12 kg, 12\.11\.2026 10:33/ });
    fireEvent.pointerEnter(box, { pointerType: 'mouse' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('12.11.2026 10:33');
    expect(box).toHaveAttribute('aria-describedby');

    fireEvent.pointerLeave(box, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('highlights the matching chart marker for a charted kind and restores it', () => {
    renderPanels();
    const box = screen.getByRole('button', { name: /Puls 82 Schläge\/min, 12\.11\.2026 09:15/ });
    fireEvent.pointerEnter(box, { pointerType: 'mouse' });

    expect(document.querySelector('circle[data-entry-id="pulse-1"]')).toHaveAttribute(
      'data-highlighted',
      'true',
    );

    fireEvent.pointerLeave(box, { pointerType: 'mouse' });
    expect(document.querySelector('circle[data-entry-id="pulse-1"]')).not.toHaveAttribute(
      'data-highlighted',
    );
  });

  it('shows only the label for an uncharted kind', () => {
    renderPanels();
    const box = screen.getByRole('button', { name: /Blutzucker 110 mg\/dL/ });
    fireEvent.pointerEnter(box, { pointerType: 'mouse' });

    expect(screen.getByRole('tooltip')).toHaveTextContent('12.11.2026 12:00');
    expect(document.querySelector('circle[data-highlighted="true"]')).toBeNull();
  });

  it('shows the tooltip on keyboard focus', () => {
    renderPanels();
    const box = screen.getByRole('button', { name: /Gewicht 12 kg/ });
    fireEvent.focus(box);
    expect(screen.getByRole('tooltip')).toHaveTextContent('12.11.2026 10:33');
  });

  it('toggles the label on touch and clears it on a tap outside', () => {
    renderPanels();
    const box = screen.getByRole('button', { name: /Gewicht 12 kg/ });

    fireEvent.pointerDown(box, { pointerType: 'touch' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('12.11.2026 10:33');

    fireEvent.pointerDown(document.body, { pointerType: 'touch' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('is read-only: no inputs, save or delete controls', () => {
    renderPanels();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Speichern|Löschen/ })).not.toBeInTheDocument();
  });
});
