import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as listRoute, POST as createRoute } from '@/app/api/patients/[patientId]/reports/route';
import { PATCH as patchRoute } from '@/app/api/patients/[patientId]/reports/[reportId]/route';
import { GET as revisionsRoute } from '@/app/api/patients/[patientId]/reports/[reportId]/revisions/route';
import { patients, studentGroups } from '@/db/schema';
import { createSession } from '@/server/auth/session';
import type { Actor } from '@/lib/types';
import { appDatabase } from '../helpers/database';
import type { Database } from '@/db/client';

let db: Database;
let groupToken = '';
let teacherToken = '';
let reportId = '';

const ORIGIN = 'http://localhost:3000';

function params(patientId: string, reportIdValue = '') {
  return { params: Promise.resolve({ patientId, reportId: reportIdValue }) };
}

function post(body: unknown, options: { cookie?: string; origin?: string | null } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.origin !== null) headers.origin = options.origin ?? ORIGIN;
  if (options.cookie) headers.cookie = options.cookie;
  return new Request(`${ORIGIN}/api/patients/p-1/reports`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function patch(body: unknown, options: { cookie?: string; origin?: string | null } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.origin !== null) headers.origin = options.origin ?? ORIGIN;
  if (options.cookie) headers.cookie = options.cookie;
  return new Request(`${ORIGIN}/api/patients/p-1/reports/${reportId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  db = await appDatabase();
  const now = new Date().toISOString();
  await db.insert(patients).values([
    { id: 'p-1', displayName: 'Frau Albrecht', createdAt: now },
    { id: 'p-2', displayName: 'Herr Brandt', createdAt: now },
  ]);
  await db.insert(studentGroups).values([
    { id: 'g-1', displayName: 'Gruppe 1', patientId: 'p-1', accessCodeHash: 'scrypt$1$1$1$00$00', isActive: 1 },
    { id: 'g-2', displayName: 'Gruppe 2', patientId: 'p-2', accessCodeHash: 'scrypt$1$1$1$00$00', isActive: 1 },
  ]);

  const group: Actor = { type: 'group', id: 'g-1', displayName: 'Gruppe 1', patientId: 'p-1' };
  const teacher: Actor = { type: 'teacher', id: 'teacher', displayName: 'Test-Lehrkraft' };
  groupToken = (await createSession(group)).token;
  teacherToken = (await createSession(teacher)).token;
});

afterAll(async () => {
  const { closeDatabase } = await import('@/db/client');
  await closeDatabase();
});

const groupCookie = () => ({ cookie: `pflege_session=${groupToken}` });

describe('reports routes', () => {
  it('answers 401 without a session', async () => {
    const response = await listRoute(new Request(`${ORIGIN}/api/patients/p-1/reports`), params('p-1'));
    expect(response.status).toBe(401);
  });

  it('answers 403 for a foreign patient', async () => {
    const response = await listRoute(
      new Request(`${ORIGIN}/api/patients/p-2/reports`, { headers: groupCookie() }),
      params('p-2'),
    );
    expect(response.status).toBe(403);
  });

  it('creates a report with 201', async () => {
    const response = await createRoute(
      post(
        {
          observedDate: '2026-11-16',
          observedTime: '06:30',
          shift: 'frueh',
          body: 'Nachtdienst übergibt.',
        },
        groupCookie(),
      ),
      params('p-1'),
    );
    expect(response.status).toBe(201);
    const payload = await response.json();
    reportId = payload.report.id;
    expect(payload.report.version).toBe(1);
  });

  it('rejects a foreign origin when creating', async () => {
    const response = await createRoute(
      post(
        { observedDate: '2026-11-16', observedTime: '07:00', shift: 'frueh', body: 'x' },
        { ...groupCookie(), origin: 'https://evil.example' },
      ),
      params('p-1'),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('ORIGIN');
  });

  it('rejects an invalid shift with 400', async () => {
    const response = await createRoute(
      post(
        { observedDate: '2026-11-16', observedTime: '07:00', shift: 'mittag', body: 'x' },
        groupCookie(),
      ),
      params('p-1'),
    );
    expect(response.status).toBe(400);
  });

  it('lists reports and their revisions', async () => {
    const list = await listRoute(
      new Request(`${ORIGIN}/api/patients/p-1/reports?limit=5`, { headers: groupCookie() }),
      params('p-1'),
    );
    expect(list.status).toBe(200);
    const payload = await list.json();
    expect(payload.reports.length).toBeGreaterThan(0);

    const revisions = await revisionsRoute(
      new Request(`${ORIGIN}/api/patients/p-1/reports/${reportId}/revisions`, {
        headers: groupCookie(),
      }),
      params('p-1', reportId),
    );
    expect(revisions.status).toBe(200);
    expect((await revisions.json()).revisions).toEqual([]);
  });

  it('edits once and then reports 409 with the current report', async () => {
    const ok = await patchRoute(patch({ version: 1, body: 'Korrigiert.' }, groupCookie()), params('p-1', reportId));
    expect(ok.status).toBe(200);
    expect((await ok.json()).report.version).toBe(2);

    const stale = await patchRoute(patch({ version: 1, body: 'Nochmal.' }, groupCookie()), params('p-1', reportId));
    expect(stale.status).toBe(409);
    const payload = await stale.json();
    expect(payload.current.version).toBe(2);
    expect(payload.current.body).toBe('Korrigiert.');
  });

  it('refuses teacher edits with 403', async () => {
    const response = await patchRoute(
      patch({ version: 2, body: 'Lehrerfassung.' }, { cookie: `pflege_session=${teacherToken}` }),
      params('p-1', reportId),
    );
    expect(response.status).toBe(403);
  });

  it('answers 404 for an unknown report', async () => {
    const response = await patchRoute(
      patch({ version: 1, body: 'x' }, groupCookie()),
      params('p-1', 'missing-id'),
    );
    expect(response.status).toBe(404);
  });
});
