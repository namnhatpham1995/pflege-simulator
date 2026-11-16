import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * scrypt parameters for the low-entropy group access codes.
 * Format: scrypt$N$r$p$saltHex$hashHex
 */
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const SALT_BYTES = 16;
const MAX_MEM = 64 * 1024 * 1024;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateAccessCode(): string {
  const bytes = randomBytes(20);
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_BYTES);
  const hash = scryptSync(plain.normalize('NFKC'), salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEM,
  });
  return `scrypt$${N}$${R}$${P}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function isPasswordHash(value: string): boolean {
  return /^scrypt\$\d+\$\d+\$\d+\$[0-9a-f]+\$[0-9a-f]+$/.test(value);
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nRaw, rRaw, pRaw, saltHex, hashHex] = parts;
  const cost = Number(nRaw);
  const blockSize = Number(rRaw);
  const parallelism = Number(pRaw);
  if (!Number.isFinite(cost) || !Number.isFinite(blockSize) || !Number.isFinite(parallelism)) {
    return false;
  }
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;
  let actual: Buffer;
  try {
    actual = scryptSync(plain.normalize('NFKC'), salt, expected.length, {
      N: cost,
      r: blockSize,
      p: parallelism,
      maxmem: MAX_MEM,
    });
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
