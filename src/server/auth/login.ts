import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { patients, studentGroups } from '@/db/schema';
import { HttpError } from '@/lib/api-error';
import { getEnv } from '@/lib/env';
import type { Actor } from '@/lib/types';
import { verifyPassword } from './password';
import {
  assertLoginAllowed,
  clearCodeAttempts,
  registerFailedAttempt,
  type AttemptKeys,
} from './rate-limit';
import { createSession, type CreatedSession } from './session';

export const GENERIC_LOGIN_FAILURE = 'Zugangscode oder Passwort ist falsch.';

export interface LoginContext {
  /** Client address used for the backstop rate limit; never stored in cleartext. */
  ip: string;
}

export interface LoginSuccess {
  actor: Actor;
  session: CreatedSession;
}

export function normalizeAccessCode(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function attemptKeys(codeKey: string, context: LoginContext): AttemptKeys {
  return { codeKey, ipKey: `ip:${sha256(context.ip)}` };
}

const TEACHER_CODE_KEY = 'code:teacher';

export async function loginWithGroupCode(
  rawCode: string,
  context: LoginContext,
): Promise<LoginSuccess> {
  const code = normalizeAccessCode(rawCode);
  if (!code) throw HttpError.validation({ code: 'Bitte den Zugangscode eingeben.' });

  const keys = attemptKeys(`code:${sha256(code)}`, context);
  await assertLoginAllowed(keys);

  const groups = await db
    .select({
      id: studentGroups.id,
      displayName: studentGroups.displayName,
      patientId: studentGroups.patientId,
      accessCodeHash: studentGroups.accessCodeHash,
    })
    .from(studentGroups)
    .where(eq(studentGroups.isActive, 1));

  const match = groups.find((group) => verifyPassword(code, group.accessCodeHash));
  if (!match) {
    await registerFailedAttempt(keys);
    throw HttpError.unauthenticated(GENERIC_LOGIN_FAILURE);
  }

  const patientRows = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.id, match.patientId))
    .limit(1);
  if (!patientRows[0]) {
    await registerFailedAttempt(keys);
    throw HttpError.unauthenticated(GENERIC_LOGIN_FAILURE);
  }

  await clearCodeAttempts(keys.codeKey);

  const actor: Actor = {
    type: 'group',
    id: match.id,
    displayName: match.displayName,
    patientId: patientRows[0].id,
  };
  return { actor, session: await createSession(actor) };
}

export async function loginAsTeacher(
  password: string,
  context: LoginContext,
): Promise<LoginSuccess> {
  if (!password) throw HttpError.validation({ password: 'Bitte das Passwort eingeben.' });

  const keys = attemptKeys(TEACHER_CODE_KEY, context);
  await assertLoginAllowed(keys);

  const env = getEnv();
  if (!verifyPassword(password, env.TEACHER_PASSWORD_HASH)) {
    await registerFailedAttempt(keys);
    throw HttpError.unauthenticated(GENERIC_LOGIN_FAILURE);
  }

  await clearCodeAttempts(keys.codeKey);

  const actor: Actor = {
    type: 'teacher',
    id: 'teacher',
    displayName: env.TEACHER_DISPLAY_NAME,
  };
  return { actor, session: await createSession(actor) };
}
