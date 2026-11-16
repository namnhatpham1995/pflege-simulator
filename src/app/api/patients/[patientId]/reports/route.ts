import { NextResponse } from 'next/server';
import { HttpError, parseJsonBody, toErrorResponse } from '@/lib/api-error';
import { requirePatientAccess, assertSameOrigin } from '@/server/services/access';
import { createReport, listReports } from '@/server/services/reports';

interface RouteContext {
  params: Promise<{ patientId: string }>;
}

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const { patientId } = await params;
    await requirePatientAccess(patientId, request);

    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam === null ? undefined : Number(limitParam);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
      throw HttpError.validation({ limit: 'limit muss eine positive Ganzzahl sein.' });
    }

    const reports = await listReports(patientId, {
      limit,
      before: url.searchParams.get('before'),
    });
    return NextResponse.json({ reports }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const { patientId } = await params;
    assertSameOrigin(request);
    const access = await requirePatientAccess(patientId, request);
    const body = await parseJsonBody(request, { parse: (value: unknown) => value });
    const report = await createReport(access.actor, patientId, body);
    return NextResponse.json({ report }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
