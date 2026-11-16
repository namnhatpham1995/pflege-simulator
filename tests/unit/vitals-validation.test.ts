import { describe, expect, it } from 'vitest';
import { categoryValueErrors, entryCreateSchema } from '@/lib/validation/vitals';

function parse(category: string, values: Record<string, string | number>, time = '09:15') {
  return entryCreateSchema.safeParse({ category, values, date: '2026-11-12', time });
}

describe('entryCreateSchema', () => {
  it('accepts each category with its own values and German decimals', () => {
    const cases: Array<[string, Record<string, string>]> = [
      ['blutdruck', { systolic: '120', diastolic: '80' }],
      ['puls', { pulse: '72' }],
      ['temperatur', { temperature: '36,8' }],
      ['gewicht', { weight: '74,5' }],
      ['groesse', { height: '178' }],
      ['schmerzen', { pain: '0' }],
      ['blutzucker', { glucose: '110' }],
    ];

    for (const [category, values] of cases) {
      const result = parse(category, values);
      expect(result.success, category).toBe(true);
    }
  });

  it('parses a comma decimal into the same number', () => {
    const result = parse('temperatur', { temperature: '36,8' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.values.temperature).toBe(36.8);
  });

  it('keeps pain 0 as a recorded value', () => {
    const result = parse('schmerzen', { pain: 0 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.values.pain).toBe(0);
      expect(categoryValueErrors('schmerzen', result.data.values)).toEqual({});
    }
  });

  it('treats a blank input as a missing required value', () => {
    const result = parse('schmerzen', { pain: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(categoryValueErrors('schmerzen', result.data.values)).toEqual({
        pain: 'Bitte einen Wert eingeben.',
      });
    }
  });

  it('rejects an unknown field inside values', () => {
    expect(parse('puls', { pulse: '72', spo2: '98' }).success).toBe(false);
  });

  it('rejects a top-level shift key', () => {
    const result = entryCreateSchema.safeParse({
      category: 'puls',
      values: { pulse: '72' },
      date: '2026-11-12',
      time: '09:15',
      shift: 'frueh',
    });
    expect(result.success).toBe(false);
  });

  it('rejects 24:00 and 12:60', () => {
    expect(parse('puls', { pulse: '72' }, '24:00').success).toBe(false);
    expect(parse('puls', { pulse: '72' }, '12:60').success).toBe(false);
  });

  it('rejects an impossible date', () => {
    const result = entryCreateSchema.safeParse({
      category: 'puls',
      values: { pulse: '72' },
      date: '2027-02-29',
      time: '09:15',
    });
    expect(result.success).toBe(false);
  });

  it('accepts 02:30 on the spring clock-change day', () => {
    const result = entryCreateSchema.safeParse({
      category: 'puls',
      values: { pulse: '72' },
      date: '2027-03-28',
      time: '02:30',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an out-of-range pulse', () => {
    expect(parse('puls', { pulse: '900' }).success).toBe(false);
  });
});

describe('categoryValueErrors', () => {
  it('requires both blood-pressure values', () => {
    expect(categoryValueErrors('blutdruck', { systolic: 120 })).toEqual({
      diastolic: 'Bitte einen Wert eingeben.',
    });
  });

  it('rejects diastolic not below systolic', () => {
    expect(categoryValueErrors('blutdruck', { systolic: 120, diastolic: 120 })).toEqual({
      diastolic: 'Der diastolische Wert muss kleiner als der systolische Wert sein.',
    });
  });

  it('rejects a value from another category', () => {
    expect(categoryValueErrors('puls', { pulse: 72, weight: 70 })).toEqual({
      weight: 'Dieser Wert gehört nicht zur gewählten Kategorie.',
    });
  });
});
