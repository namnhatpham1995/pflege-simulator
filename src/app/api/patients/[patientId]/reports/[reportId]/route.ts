import { NextResponse } from 'next/server';
import { parseJsonBody, toErrorResponse } from '@/lib/api-error';
import { requirePatientAccess, assertSameOrigin } from '@/server/services/access';
import { updateReport } from '@/server/services/reports';

interface RouteContext {
  params: Promise<{ patientId: string; reportId: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const { patientId, reportId } = await params;
    assertSameOrigin(request);
    const access = await requirePatientAccess(patientId, request);
    const body = await parseJsonBody(request, { parse: (value: unknown) => value });
    const report = await updateReport(access.actor, patientId, reportId, body);
    return NextResponse.json({ report }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
