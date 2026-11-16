import { NextResponse } from 'next/server';
import { parseJsonBody, toErrorResponse } from '@/lib/api-error';
import { assertSameOrigin, requirePatientAccess } from '@/server/services/access';
import {
  getRequirementPolicy,
  updateRequirementPolicy,
} from '@/server/services/requirements';

interface RouteContext {
  params: Promise<{ patientId: string }>;
}

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const { patientId } = await params;
    await requirePatientAccess(patientId, request);
    const requirements = await getRequirementPolicy(patientId);
    return NextResponse.json({ requirements }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const { patientId } = await params;
    assertSameOrigin(request);
    const access = await requirePatientAccess(patientId, request);
    const body = await parseJsonBody(request, { parse: (value: unknown) => value });
    const requirements = await updateRequirementPolicy(access.actor, patientId, body);
    return NextResponse.json({ requirements }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
