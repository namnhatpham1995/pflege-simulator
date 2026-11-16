import { describe, expect, it } from 'vitest';
import { getMissingFields } from '@/lib/missing-value-policy';
import { emptyValues } from '@/lib/vitals';
import { BASE_REQUIREMENTS } from '../helpers/vitals';

describe('getMissingFields', () => {
  it('reports an expected but empty field', () => {
    const missing = getMissingFields({ ...emptyValues(), systolic: 120 }, BASE_REQUIREMENTS);
    expect(missing).toEqual(['diastolic', 'pulse']);
  });

  it('does not report an optional empty field', () => {
    const missing = getMissingFields(
      { ...emptyValues(), systolic: 120, diastolic: 80, pulse: 70 },
      BASE_REQUIREMENTS,
    );
    expect(missing).toEqual([]);
  });

  it('treats a stored zero as present', () => {
    const missing = getMissingFields(
      { ...emptyValues(), systolic: 120, diastolic: 80, pulse: 70, pain: 0 },
      { ...BASE_REQUIREMENTS, pain: true },
    );
    expect(missing).toEqual([]);
  });

  it('treats a day without a record as all expected fields missing', () => {
    expect(getMissingFields(null, BASE_REQUIREMENTS)).toEqual(['systolic', 'diastolic', 'pulse']);
  });

  it('honours a widened policy', () => {
    const allExpected = {
      systolic: true,
      diastolic: true,
      pulse: true,
      temperature: true,
      weight: true,
      height: true,
      pain: true,
      glucose: true,
    };
    expect(getMissingFields(emptyValues(), allExpected)).toHaveLength(8);
  });
});
