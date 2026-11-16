import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().trim().min(1).default('file:./.local/dev.db'),
  TURSO_DATABASE_URL: z.string().trim().min(1).optional(),
  TURSO_AUTH_TOKEN: z.string().trim().min(1).optional(),
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET muss mindestens 32 Zeichen lang sein.'),
  TEACHER_PASSWORD: z.string().min(1, 'TEACHER_PASSWORD darf nicht leer sein.'),
  TEACHER_DISPLAY_NAME: z.string().trim().min(1).default('Lehrkraft'),
  APP_ORIGIN: z.string().url().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Ungültige Umgebungsvariablen:\n${details}`);
  }
  return result.data;
}

let cachedEnv: Env | null = null;

/** Lazily validated so a build without secrets does not fail at import time. */
export function getEnv(): Env {
  if (!cachedEnv) cachedEnv = parseEnv();
  return cachedEnv;
}

/** Test helper: forget the memoised environment. */
export function resetEnvCache(): void {
  cachedEnv = null;
}
