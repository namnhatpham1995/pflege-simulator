import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api-error';
import { assertSameOrigin, requirePatientAccess } from '@/server/services/access';
import { deleteEntries } from '@/server/services/vitals';

interface RouteContext {
  params: Promise<{ patientId: string; submissionId: string }>;
}

export async function DELETE(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const { patientId, submissionId } = await params;
    assertSameOrigin(request);
    const access = await requirePatientAccess(patientId, request);

    const result = await deleteEntries(access.actor, patientId, submissionId);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
