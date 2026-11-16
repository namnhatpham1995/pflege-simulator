import { describe, expect, it } from 'vitest';
import { careReportCreateSchema, careReportUpdateSchema } from '@/lib/validation/reports';

const valid = {
  observedDate: '2026-11-16',
  observedTime: '14:30',
  shift: 'spaet',
  body: 'Patientin wirkt ruhig.',
};

describe('careReportCreateSchema', () => {
  it('accepts a complete report and trims the body', () => {
    const result = careReportCreateSchema.safeParse({ ...valid, body: '  Text  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.body).toBe('Text');
  });

  it('rejects a whitespace-only body', () => {
    expect(careReportCreateSchema.safeParse({ ...valid, body: '   ' }).success).toBe(false);
  });

  it('rejects a body longer than 10.000 characters', () => {
    expect(careReportCreateSchema.safeParse({ ...valid, body: 'a'.repeat(10_001) }).success).toBe(false);
    expect(careReportCreateSchema.safeParse({ ...valid, body: 'a'.repeat(10_000) }).success).toBe(true);
  });

  it('rejects an unknown shift', () => {
    expect(careReportCreateSchema.safeParse({ ...valid, shift: 'mittag' }).success).toBe(false);
  });

  it('rejects invalid dates and times', () => {
    expect(careReportCreateSchema.safeParse({ ...valid, observedDate: '2027-02-29' }).success).toBe(false);
    expect(careReportCreateSchema.safeParse({ ...valid, observedTime: '24:00' }).success).toBe(false);
    expect(careReportCreateSchema.safeParse({ ...valid, observedTime: '9:05' }).success).toBe(false);
  });

  it('rejects unknown keys', () => {
    expect(careReportCreateSchema.safeParse({ ...valid, patientId: 'other' }).success).toBe(false);
  });
});

describe('careReportUpdateSchema', () => {
  it('requires a positive version and a non-empty body', () => {
    expect(careReportUpdateSchema.safeParse({ version: 1, body: 'ok' }).success).toBe(true);
    expect(careReportUpdateSchema.safeParse({ version: 0, body: 'ok' }).success).toBe(false);
    expect(careReportUpdateSchema.safeParse({ version: 1, body: '' }).success).toBe(false);
  });

  it('does not accept a date, time or shift change', () => {
    expect(
      careReportUpdateSchema.safeParse({ version: 1, body: 'ok', shift: 'nacht' }).success,
    ).toBe(false);
  });
});
