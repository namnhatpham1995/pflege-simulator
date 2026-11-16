import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody, toErrorResponse } from '@/lib/api-error';
import { SESSION_COOKIE_NAME } from '@/lib/types';
import { loginAsTeacher, loginWithGroupCode } from '@/server/auth/login';
import {
  destroySession,
  readCookieValue,
  sessionCookieOptions,
} from '@/server/auth/session';
import { assertSameOrigin } from '@/server/services/access';

const loginBodySchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('group'), code: z.string().min(1) }),
  z.strictObject({ mode: z.literal('teacher'), password: z.string().min(1) }),
]);

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const body = await parseJsonBody(request, loginBodySchema);
    const context = { ip: clientIp(request) };

    const result =
      body.mode === 'group'
        ? await loginWithGroupCode(body.code, context)
        : await loginAsTeacher(body.password, context);

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
