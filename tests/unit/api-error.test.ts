import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { HttpError, mapError, toErrorResponse } from '@/lib/api-error';

describe('mapError', () => {
  it('maps an HttpError to its status and code', () => {
    const mapped = mapError(HttpError.forbidden('Kein Zugriff.'));
    expect(mapped.status).toBe(403);
    expect(mapped.body.error.code).toBe('FORBIDDEN');
    expect(mapped.body.error.message).toBe('Kein Zugriff.');
  });

  it('maps a rate limit with Retry-After', () => {
    const mapped = mapError(HttpError.rateLimited(120));
    expect(mapped.status).toBe(429);
    expect(mapped.headers).toEqual({ 'Retry-After': '120' });
  });

  it('maps Zod issues to field messages', () => {
    const schema = z.object({ systolic: z.number().int().min(50) });
    const result = schema.safeParse({ systolic: 10 });
    if (result.success) throw new Error('expected a failure');
    const mapped = mapError(result.error);
    expect(mapped.status).toBe(400);
    expect(mapped.body.error.code).toBe('VALIDATION');
    expect(mapped.body.error.fields).toHaveProperty('systolic');
  });

  it('does not leak internal error details', () => {
    const mapped = mapError(new Error('database password is hunter2'));
    expect(mapped.status).toBe(500);
    expect(JSON.stringify(mapped.body)).not.toContain('hunter2');
  });

  it('produces a JSON response with no-store caching', async () => {
    const response = toErrorResponse(HttpError.notFound());
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toContain('no-store');
    await expect(response.json()).resolves.toEqual({
      error: { code: 'NOT_FOUND', message: 'Nicht gefunden.' },
    });
  });
});
