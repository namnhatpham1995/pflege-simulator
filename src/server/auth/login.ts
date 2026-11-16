import { createHash, timingSafeEqual } from 'node:crypto';
import { HttpError } from '@/lib/api-error';
import { getEnv } from '@/lib/env';
import type { Actor } from '@/lib/types';
import {
  assertLoginAllowed,
  clearCodeAttempts,
  registerFailedAttempt,
  type AttemptKeys,
} from './rate-limit';
import { createSession, type CreatedSession } from './session';

export const GENERIC_LOGIN_FAILURE = 'Das Passwort ist falsch.';

export interface LoginContext {
  /** Client address used for the backstop rate limit; never stored in cleartext. */
  ip: string;
}

export interface LoginSuccess {
  actor: Actor;
  session: CreatedSession;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Constant-time comparison of two strings of any length. */
function passwordMatches(given: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

const TEACHER_CODE_KEY = 'code:teacher';

export async function loginAsTeacher(
  password: string,
  context: LoginContext,
): Promise<LoginSuccess> {
  if (!password) throw HttpError.validation({ password: 'Bitte das Passwort eingeben.' });

  const keys: AttemptKeys = {
    codeKey: TEACHER_CODE_KEY,
    ipKey: `ip:${sha256(context.ip)}`,
  };
  await assertLoginAllowed(keys);

  const env = getEnv();
  if (!passwordMatches(password, env.TEACHER_PASSWORD)) {
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
