// @vitest-environment jsdom
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePartsPicker } from '@/components/date-parts-picker';

function Harness({
  initial = '2026-11-16',
  onChange,
}: {
  initial?: string;
  onChange?: (date: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div>
      <DatePartsPicker
        value={value}
        onChange={(date) => {
          onChange?.(date);
          setValue(date);
        }}
      />
      <output data-testid="value">{value}</output>
    </div>
  );
}

function currentValue() {
  return screen.getByTestId('value').textContent;
}

async function typeInto(label: string, text: string) {
  const input = screen.getByLabelText(label);
  await userEvent.clear(input);
  await userEvent.type(input, text);
  return input;
}

describe('day, month and year controls', () => {
  it('renders three independently editable controls', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Tag')).toHaveValue('16');
    expect(screen.getByLabelText('Monat')).toHaveValue('11');
    expect(screen.getByLabelText('Jahr')).toHaveValue('2026');
  });

  it('offers 29 days for February 2028 and 28 days for February 2027', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness initial="2028-02-15" />);
    await user.click(screen.getByLabelText('Tag'));
    expect(within(screen.getByRole('group', { name: 'Tag' })).getAllByRole('button')).toHaveLength(29);
    unmount();

    render(<Harness initial="2027-02-15" />);
    await user.click(screen.getByLabelText('Tag'));
    expect(within(screen.getByRole('group', { name: 'Tag' })).getAllByRole('button')).toHaveLength(28);
  });

  it('follows the selected month when the month changes', async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-01-31" />);

    await user.click(screen.getByLabelText('Monat'));
    const months = within(screen.getByRole('group', { name: 'Monat' }));
    expect(months.getAllByRole('button')).toHaveLength(12);
    await user.click(months.getByRole('button', { name: 'April' }));

    await user.click(screen.getByLabelText('Tag'));
    expect(within(screen.getByRole('group', { name: 'Tag' })).getAllByRole('button')).toHaveLength(30);
    expect(currentValue()).toBe('2026-04-30');
  });

  it('accepts a freely typed year outside any preset range', async () => {
    render(<Harness />);
    await typeInto('Jahr', '2126');
    await userEvent.keyboard('{Enter}');
    expect(currentValue()).toBe('2126-11-16');
  });

  it('accepts a typed month', async () => {
    render(<Harness />);
    await typeInto('Monat', '3');
    await userEvent.keyboard('{Enter}');
    expect(currentValue()).toBe('2026-03-16');
  });
});

describe('invalid combinations', () => {
  it('refuses 31 February with an inline error and no change', async () => {
    const onChange = vi.fn();
    render(<Harness initial="2027-02-15" onChange={onChange} />);

    await typeInto('Tag', '31');
    await userEvent.keyboard('{Enter}');

    expect(screen.getByRole('alert')).toHaveTextContent('31.02.2027');
    expect(currentValue()).toBe('2027-02-15');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('accepts 29 February 2028 and refuses it in 2027', async () => {
    const { unmount } = render(<Harness initial="2028-02-15" />);
    await typeInto('Tag', '29');
    await userEvent.keyboard('{Enter}');
    expect(currentValue()).toBe('2028-02-29');
    unmount();

    render(<Harness initial="2027-02-15" />);
    await typeInto('Tag', '29');
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(currentValue()).toBe('2027-02-15');
  });
});

describe('calendar popover', () => {
  it('opens, selects a full date and closes', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Kalender öffnen' }));
    const dialog = screen.getByRole('dialog', { name: 'Kalender' });
    expect(within(dialog).getByText('November 2026')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '20. November 2026' }));
    expect(currentValue()).toBe('2026-11-20');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape and returns focus to its trigger', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Kalender öffnen' });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe('keyboard and pointer operation', () => {
  it('reaches the day list and selects with arrows and Enter', async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-11-01" />);

    await user.click(screen.getByLabelText('Tag'));
    await user.keyboard('{ArrowDown}');
    expect(within(screen.getByRole('group', { name: 'Tag' })).getByRole('button', { name: '1' })).toHaveFocus();

    await user.keyboard('{ArrowRight}{ArrowRight}');
    await user.keyboard('{Enter}');

    expect(currentValue()).toBe('2026-11-03');
    expect(screen.queryByRole('group', { name: 'Tag' })).not.toBeInTheDocument();
  });

  it('closes an open list with Escape and keeps the input focused', async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-11-05" />);

    const dayInput = screen.getByLabelText('Tag');
    await user.click(dayInput);
    await user.keyboard('{ArrowDown}{Escape}');

    expect(screen.queryByRole('group', { name: 'Tag' })).not.toBeInTheDocument();
    expect(dayInput).toHaveFocus();
    expect(currentValue()).toBe('2026-11-05');
  });

  it('emits exactly one change per pointer selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="2026-11-16" onChange={onChange} />);

    await user.click(screen.getByLabelText('Tag'));
    await user.click(within(screen.getByRole('group', { name: 'Tag' })).getByRole('button', { name: '12' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('2026-11-12');

    await user.click(screen.getByLabelText('Tag'));
    await user.click(within(screen.getByRole('group', { name: 'Tag' })).getByRole('button', { name: '13' }));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith('2026-11-13');
  });
});
