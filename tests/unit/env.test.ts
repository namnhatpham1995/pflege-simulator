import { describe, expect, it } from 'vitest';
import { parseEnv } from '@/lib/env';

const validEnv = {
  SESSION_SECRET: '0123456789abcdef0123456789abcdef',
  TEACHER_PASSWORD: 'teacher@1234',
};

describe('parseEnv', () => {
  it('accepts a complete environment and applies defaults', () => {
    const env = parseEnv(validEnv);
    expect(env.DATABASE_URL).toBe('file:./.local/dev.db');
    expect(env.TEACHER_DISPLAY_NAME).toBe('Lehrkraft');
    expect(env.APP_ORIGIN).toBe('http://localhost:3000');
  });

  it('rejects a missing SESSION_SECRET', () => {
    expect(() => parseEnv({ TEACHER_PASSWORD: 'teacher@1234' })).toThrow(/SESSION_SECRET/);
  });

  it('rejects a SESSION_SECRET shorter than 32 characters', () => {
    expect(() =>
      parseEnv({ ...validEnv, SESSION_SECRET: 'too-short' }),
    ).toThrow(/SESSION_SECRET/);
  });

  it('rejects a missing TEACHER_PASSWORD', () => {
    expect(() => parseEnv({ SESSION_SECRET: validEnv.SESSION_SECRET })).toThrow(/TEACHER_PASSWORD/);
  });

  it('rejects an empty TEACHER_PASSWORD', () => {
    expect(() => parseEnv({ ...validEnv, TEACHER_PASSWORD: '' })).toThrow(/TEACHER_PASSWORD/);
  });
});
