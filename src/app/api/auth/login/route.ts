import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody, toErrorResponse } from '@/lib/api-error';
import { SESSION_COOKIE_NAME } from '@/lib/types';
import { loginAsTeacher } from '@/server/auth/login';
import {
  destroySession,
  readCookieValue,
  sessionCookieOptions,
} from '@/server/auth/session';
import { assertSameOrigin } from '@/server/services/access';

const loginBodySchema = z.strictObject({
  password: z.string({ required_error: 'Bitte das Passwort eingeben.' }).min(1),
});

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = await parseJsonBody(request, loginBodySchema);

    const result = await loginAsTeacher(body.password, { ip: clientIp(request) });

    // Session fixation: an existing cookie is revoked before issuing the new one.
    const existingToken = readCookieValue(request.headers.get('cookie'), SESSION_COOKIE_NAME);
    if (existingToken) await destroySession(existingToken);

    const response = NextResponse.json(
      { actor: result.actor },
      { headers: { 'Cache-Control': 'no-store' } },
    );
    response.cookies.set(SESSION_COOKIE_NAME, result.session.token, sessionCookieOptions());
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
