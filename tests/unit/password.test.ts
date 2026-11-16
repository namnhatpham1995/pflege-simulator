import { describe, expect, it } from 'vitest';
import {
  generateAccessCode,
  hashPassword,
  isPasswordHash,
  verifyPassword,
} from '@/server/auth/password';

describe('scrypt password helpers', () => {
  it('produces a verifiable scrypt hash in the documented format', () => {
    const hash = hashPassword('probe-passwort');
    expect(isPasswordHash(hash)).toBe(true);
    expect(hash.startsWith('scrypt$16384$8$1$')).toBe(true);
    expect(verifyPassword('probe-passwort', hash)).toBe(true);
    expect(verifyPassword('Probe-passwort', hash)).toBe(false);
  });

  it('uses a fresh salt per hash', () => {
    const first = hashPassword('gleich');
    const second = hashPassword('gleich');
    expect(first).not.toBe(second);
    expect(verifyPassword('gleich', first)).toBe(true);
    expect(verifyPassword('gleich', second)).toBe(true);
  });

  it('rejects malformed or truncated stored hashes', () => {
    expect(verifyPassword('x', 'gruppe1')).toBe(false);
    expect(verifyPassword('x', 'scrypt$16384$8$1$00$00')).toBe(false);
  });

  it('generates 32-character base32 access codes without ambiguous padding', () => {
    const code = generateAccessCode();
    expect(code).toHaveLength(32);
    expect(code).toMatch(/^[A-Z2-7]{32}$/);
    expect(generateAccessCode()).not.toBe(code);
  });
});
