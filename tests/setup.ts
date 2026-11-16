import { afterEach } from 'vitest';

/**
 * Deterministic, non-production defaults so tests never depend on a local .env
 * file. The database path is unique per test file; tests/helpers/database.ts
 * migrates it on demand.
 */
const mutableEnv = process.env as Record<string, string | undefined>;
mutableEnv.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ?? 'test-session-secret-0123456789abcdef';
process.env.TEACHER_PASSWORD = process.env.TEACHER_PASSWORD ?? 'lehrer-test-passwort';
process.env.TEACHER_DISPLAY_NAME = process.env.TEACHER_DISPLAY_NAME ?? 'Test-Lehrkraft';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  `file:./.local/test-${process.pid}-${Math.random().toString(36).slice(2, 8)}.db`;

if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');
  afterEach(() => cleanup());
}
