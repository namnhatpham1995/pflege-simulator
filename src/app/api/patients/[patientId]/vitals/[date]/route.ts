import { NextResponse } from 'next/server';
import { HttpError, parseJsonBody, toErrorResponse } from '@/lib/api-error';
import { requirePatientAccess, assertSameOrigin } from '@/server/services/access';
import { getVitalsDay, saveVitalsDay } from '@/server/services/vitals';
import { vitalsPatchSchema } from '@/lib/validation/vitals';

interface RouteContext {
  params: Promise<{ patientId: string; date: string }>;
}

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const { patientId, date } = await params;
    await requirePatientAccess(patientId, request);

    const record = await getVitalsDay(patientId, date);
    return NextResponse.json(
      { record, version: record?.version ?? 0 },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const { patientId, date } = await params;
    assertSameOrigin(request);
    const access = await requirePatientAccess(patientId, request);
    if (access.actor.type !== 'group') {
      throw HttpError.forbidden('Die Lehrkraft hat nur lesenden Zugriff.');
    }

    const body = await parseJsonBody(request, vitalsPatchSchema);
    const saved = await saveVitalsDay(access.actor, patientId, date, body);

    return NextResponse.json(saved, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
