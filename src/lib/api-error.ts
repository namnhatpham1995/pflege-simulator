import { ZodError } from 'zod';
import type { ApiErrorBody, ApiErrorCode } from './types';

const DEFAULT_MESSAGES: Record<ApiErrorCode, string> = {
  UNAUTHENTICATED: 'Nicht angemeldet.',
  FORBIDDEN: 'Kein Zugriff auf diese Daten.',
  NOT_FOUND: 'Nicht gefunden.',
  VALIDATION: 'Die Eingaben sind ungültig.',
  CONFLICT: 'Der Datensatz wurde zwischenzeitlich geändert.',
  RATE_LIMITED: 'Zu viele Versuche. Bitte später erneut versuchen.',
  ORIGIN: 'Die Anfrage stammt nicht von dieser Anwendung.',
  INTERNAL: 'Interner Fehler.',
};

export class HttpError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fields?: Record<string, string>;
  readonly retryAfterSeconds?: number;
  readonly extra?: Record<string, unknown>;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string = DEFAULT_MESSAGES[code],
    options: {
      fields?: Record<string, string>;
      retryAfterSeconds?: number;
      extra?: Record<string, unknown>;
    } = {},
  ) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.fields = options.fields;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.extra = options.extra;
  }

  static unauthenticated(message?: string): HttpError {
    return new HttpError(401, 'UNAUTHENTICATED', message);
  }

  static forbidden(message?: string): HttpError {
    return new HttpError(403, 'FORBIDDEN', message);
  }

  static notFound(message?: string): HttpError {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  static validation(fields: Record<string, string>, message?: string): HttpError {
    return new HttpError(400, 'VALIDATION', message, { fields });
  }

  static conflict(message?: string): HttpError {
    return new HttpError(409, 'CONFLICT', message);
  }

  static rateLimited(retryAfterSeconds: number, message?: string): HttpError {
    return new HttpError(429, 'RATE_LIMITED', message, { retryAfterSeconds });
  }

  static origin(message?: string): HttpError {
    return new HttpError(403, 'ORIGIN', message);
  }
}

export interface MappedError {
  status: number;
  body: ApiErrorBody & Record<string, unknown>;
  headers?: Record<string, string>;
}

function zodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : '_';
    if (!fields[path]) fields[path] = issue.message;
  }
  return fields;
}

export function validationErrorFromZod(error: ZodError): HttpError {
  return HttpError.validation(zodFields(error));
}

export function mapError(error: unknown): MappedError {
  if (error instanceof HttpError) {
    const body: ApiErrorBody = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields ? { fields: error.fields } : {}),
      },
    };
    const headers: Record<string, string> = {};
    if (error.retryAfterSeconds !== undefined) {
      headers['Retry-After'] = String(error.retryAfterSeconds);
    }
    return {
      status: error.status,
      body: { ...body, ...(error.extra ?? {}) },
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    };
  }

  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: 'VALIDATION',
          message: DEFAULT_MESSAGES.VALIDATION,
          fields: zodFields(error),
        },
      },
    };
  }

  return {
    status: 500,
    body: { error: { code: 'INTERNAL', message: DEFAULT_MESSAGES.INTERNAL } },
  };
}

export function toErrorResponse(error: unknown): Response {
  const mapped = mapError(error);
  return Response.json(mapped.body, {
    status: mapped.status,
    headers: { 'Cache-Control': 'no-store', ...mapped.headers },
  });
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw HttpError.validation({ _: 'Der Anfragekörper ist kein gültiges JSON.' });
  }
}

export async function parseJsonBody<T>(request: Request, schema: { parse: (value: unknown) => T }): Promise<T> {
  return schema.parse(await readJsonBody(request));
}
