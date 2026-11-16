import { NextResponse } from 'next/server';
import { HttpError, toErrorResponse } from '@/lib/api-error';
import { SESSION_COOKIE_NAME } from '@/lib/types';
import {
  destroySession,
  readCookieValue,
  sessionCookieOptions,
} from '@/server/auth/session';
import { assertSameOrigin } from '@/server/services/access';

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const token = readCookieValue(request.headers.get('cookie'), SESSION_COOKIE_NAME);
    if (!token) throw HttpError.unauthenticated('Es besteht keine Sitzung.');

    await destroySession(token);

    const response = new NextResponse(null, { status: 204 });
    response.cookies.set(SESSION_COOKIE_NAME, '', {
      ...sessionCookieOptions(),
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
