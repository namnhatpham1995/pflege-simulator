import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { auditLog, careReportRevisions, careReports, patients, studentGroups } from '@/db/schema';
import { HttpError } from '@/lib/api-error';
import type { Actor } from '@/lib/types';
import {
  createReport,
  listReportRevisions,
  listReports,
  updateReport,
} from '@/server/services/reports';
import { anonymousActor } from '@/server/services/access';
import { appDatabase } from '../helpers/database';
import type { Database } from '@/db/client';

let db: Database;

const groupA: Actor = { type: 'group', id: 'g-1', displayName: 'Gruppe 1', patientId: 'p-1' };
const groupB: Actor = { type: 'group', id: 'g-2', displayName: 'Gruppe 2', patientId: 'p-2' };
const teacher: Actor = { type: 'teacher', id: 'teacher', displayName: 'Lehrkraft' };

async function expectStatus(promise: Promise<unknown>, status: number) {
  try {
    await promise;
    throw new Error('expected the call to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(status);
    return error as HttpError;
  }
}

function reportInput(overrides: Record<string, unknown> = {}) {
  return {
    observedDate: '2026-11-16',
    observedTime: '08:00',
    shift: 'frueh',
    body: 'Erster Eintrag.',
    ...overrides,
  };
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
});

afterAll(async () => {
  const { closeDatabase } = await import('@/db/client');
  await closeDatabase();
});

describe('createReport', () => {
  it('allows several reports on the same day and shift', async () => {
    const first = await createReport(groupA, 'p-1', reportInput({ observedTime: '08:00' }));
    const second = await createReport(groupA, 'p-1', reportInput({ observedTime: '08:00', body: 'Zweiter Eintrag.' }));

    expect(first.id).not.toBe(second.id);
    expect(second.version).toBe(1);
    expect(second.groupId).toBeNull();

    const stored = await db.select({ count: sql<number>`count(*)` }).from(careReports);
    expect(stored[0]?.count).toBe(2);
  });

  it('trims the body and writes one audit row', async () => {
    const report = await createReport(groupA, 'p-1', reportInput({ body: '  Mit Leerzeichen  ' }));
    expect(report.body).toBe('Mit Leerzeichen');

    const audits = await db.select().from(auditLog);
    expect(audits.some((row) => row.entityId === report.id && row.action === 'create')).toBe(true);
  });

  it('refuses the teacher and another group', async () => {
    await expectStatus(createReport(teacher, 'p-1', reportInput()), 403);
    await expectStatus(createReport(groupB, 'p-1', reportInput()), 403);
  });

  it('rejects an invalid body', async () => {
    await expectStatus(createReport(groupA, 'p-1', reportInput({ body: '' })), 400);
  });
});

describe('listReports', () => {
  it('returns newest first with a stable tie-break', async () => {
    await createReport(groupA, 'p-1', {
      observedDate: '2026-11-17',
      observedTime: '09:00',
      shift: 'frueh',
      body: 'Neun Uhr.',
    });
    await createReport(groupA, 'p-1', {
      observedDate: '2026-11-17',
      observedTime: '14:00',
      shift: 'spaet',
      body: 'Vierzehn Uhr.',
    });

    const page = await listReports('p-1', { limit: 50 });
    const dates = page.map((report) => `${report.observedDate} ${report.observedTime}`);
    expect(dates[0]).toBe('2026-11-17 14:00');
    expect(dates[1]).toBe('2026-11-17 09:00');

    const second = await listReports('p-1', { limit: 50 });
    expect(second.map((report) => report.id)).toEqual(page.map((report) => report.id));
  });

  it('paginates with a cursor and caps the limit', async () => {
    const firstPage = await listReports('p-1', { limit: 2 });
    expect(firstPage).toHaveLength(2);

    const last = firstPage[1]!;
    const cursor = `${last.observedDate}|${last.observedTime}|${last.id}`;
    const secondPage = await listReports('p-1', { limit: 2, before: cursor });

    const ids = [...firstPage, ...secondPage].map((report) => report.id);
    expect(new Set(ids).size).toBe(ids.length);

    const huge = await listReports('p-1', { limit: 500 });
    expect(huge.length).toBeLessThanOrEqual(50);
  });

  it('rejects a malformed cursor', async () => {
    await expectStatus(listReports('p-1', { before: 'nonsense' }), 400);
  });
});

describe('updateReport and revisions', () => {
  it('keeps the previous body as one revision per accepted edit', async () => {
    const created = await createReport(groupA, 'p-1', reportInput({ body: 'Originaltext.' }));

    const updated = await updateReport(groupA, 'p-1', created.id, {
      version: created.version,
      body: 'Korrigierter Text.',
    });
    expect(updated.version).toBe(2);
    expect(updated.body).toBe('Korrigierter Text.');

    const revisions = await listReportRevisions('p-1', created.id);
    expect(revisions).toHaveLength(1);
    expect(revisions[0]?.version).toBe(1);
    expect(revisions[0]?.body).toBe('Originaltext.');
  });

  it('refuses a stale edit, returns the current report and writes no revision', async () => {
    const created = await createReport(groupA, 'p-1', reportInput({ body: 'Ausgangslage.' }));
    await updateReport(groupA, 'p-1', created.id, { version: 1, body: 'Neu.' });
    const before = await listReportRevisions('p-1', created.id);

    const error = await expectStatus(
      updateReport(groupA, 'p-1', created.id, { version: 1, body: 'Veraltet.' }),
      409,
    );
    const current = error.extra?.current as { body: string; version: number };
    expect(current.version).toBe(2);
    expect(current.body).toBe('Neu.');

    const after = await listReportRevisions('p-1', created.id);
    expect(after).toHaveLength(before.length);
    expect(after.at(-1)?.body).toBe('Ausgangslage.');
  });

  it('records the anonymous patient actor on a report edit', async () => {
    const student = anonymousActor('p-1');
    const created = await createReport(student, 'p-1', reportInput({ body: 'Anonym.' }));
    await updateReport(student, 'p-1', created.id, { version: 1, body: 'Neu.' });

    const revisions = await listReportRevisions('p-1', created.id);
    expect(revisions[0]?.actorType).toBe('group');
    expect(revisions[0]?.actorId).toBe('patient:p-1');
  });

  it('answers 404 for an unknown report and for a foreign patient', async () => {
    await expectStatus(
      updateReport(groupA, 'p-1', 'does-not-exist', { version: 1, body: 'x' }),
      404,
    );

    const created = await createReport(groupA, 'p-1', reportInput());
    await expectStatus(listReportRevisions('p-2', created.id), 404);
  });
});
