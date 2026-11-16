import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api-error';
import { requirePatientAccess } from '@/server/services/access';
import { listReportRevisions } from '@/server/services/reports';

interface RouteContext {
  params: Promise<{ patientId: string; reportId: string }>;
}

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const { patientId, reportId } = await params;
    await requirePatientAccess(patientId, request);
    const revisions = await listReportRevisions(patientId, reportId);
    return NextResponse.json({ revisions }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
