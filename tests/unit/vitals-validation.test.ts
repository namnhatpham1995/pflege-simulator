import { describe, expect, it } from 'vitest';
import { VITAL_FIELDS } from '@/lib/types';
import { VITAL_RULES, crossFieldErrors, vitalsPatchSchema } from '@/lib/validation/vitals';

function parseValue(field: string, value: unknown) {
  return vitalsPatchSchema.safeParse({ version: 0, values: { [field]: value } });
}

describe('field ranges', () => {
  for (const field of VITAL_FIELDS) {
    const rule = VITAL_RULES[field];

    it(`${field} accepts both bounds`, () => {
      expect(parseValue(field, rule.min).success).toBe(true);
      expect(parseValue(field, rule.max).success).toBe(true);
    });

    it(`${field} rejects values outside the range`, () => {
      expect(parseValue(field, rule.min - 1).success).toBe(false);
      expect(parseValue(field, rule.max + 1).success).toBe(false);
    });

    it(`${field} accepts null and an empty string as clear`, () => {
      const fromNull = parseValue(field, null);
      const fromEmpty = parseValue(field, '');
      expect(fromNull.success).toBe(true);
      expect(fromEmpty.success).toBe(true);
      if (fromNull.success) expect(fromNull.data.values[field as keyof typeof fromNull.data.values]).toBeNull();
      if (fromEmpty.success) expect(fromEmpty.data.values[field as keyof typeof fromEmpty.data.values]).toBeNull();
    });
  }
});

describe('pain and integers', () => {
  it('stores pain 0 as a value, not as missing', () => {
    const result = parseValue('pain', 0);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.values.pain).toBe(0);
  });

  it('rejects a fractional integer field', () => {
    expect(parseValue('pulse', 72.5).success).toBe(false);
    expect(parseValue('pain', 3.2).success).toBe(false);
  });

  it('accepts bacteria-free decimals for temperature', () => {
    const result = parseValue('temperature', 36.8);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.values.temperature).toBe(36.8);
  });
});

describe('payload shape', () => {
  it('accepts a comma decimal and normalises it', () => {
    const result = vitalsPatchSchema.safeParse({ version: 0, values: { temperature: '36,8' } });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.values.temperature).toBe(36.8);
  });

  it('rejects unknown keys, including a shift', () => {
    expect(vitalsPatchSchema.safeParse({ version: 0, values: { shift: 'frueh' } }).success).toBe(false);
    expect(vitalsPatchSchema.safeParse({ version: 0, values: { weight: 70, extra: 1 } }).success).toBe(false);
    expect(vitalsPatchSchema.safeParse({ version: 0, values: {}, shift: 'frueh' }).success).toBe(false);
  });

  it('requires a non-negative integer version', () => {
    expect(vitalsPatchSchema.safeParse({ values: {} }).success).toBe(false);
    expect(vitalsPatchSchema.safeParse({ version: -1, values: {} }).success).toBe(false);
    expect(vitalsPatchSchema.safeParse({ version: 1.5, values: {} }).success).toBe(false);
    expect(vitalsPatchSchema.safeParse({ version: 0, values: {} }).success).toBe(true);
  });

  it('rejects a non-numeric text value', () => {
    expect(parseValue('pulse', 'schnell').success).toBe(false);
  });
});

describe('cross-field rule', () => {
  const empty = {
    systolic: null,
    diastolic: null,
    pulse: null,
    temperature: null,
    weight: null,
    height: null,
    pain: null,
    glucose: null,
  };

  it('accepts diastolic below systolic', () => {
    expect(crossFieldErrors({ ...empty, systolic: 120, diastolic: 80 })).toEqual({});
  });

  it('rejects diastolic equal to or above systolic', () => {
    expect(crossFieldErrors({ ...empty, systolic: 120, diastolic: 120 }).diastolic).toBeTruthy();
    expect(crossFieldErrors({ ...empty, systolic: 120, diastolic: 130 }).diastolic).toBeTruthy();
  });

  it('does not complain when only one of the pair is present', () => {
    expect(crossFieldErrors({ ...empty, systolic: 120 })).toEqual({});
    expect(crossFieldErrors({ ...empty, diastolic: 90 })).toEqual({});
  });
});
