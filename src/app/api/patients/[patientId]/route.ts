import { NextResponse } from 'next/server';
import { HttpError, toErrorResponse } from '@/lib/api-error';
import { assertSameOrigin, requirePatientAccess, requireTeacher } from '@/server/services/access';
import { updatePatient } from '@/server/services/patients';

interface RouteContext {
  params: Promise<{ patientId: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const { patientId } = await params;
    assertSameOrigin(request);
    await requirePatientAccess(patientId, request);
    const actor = await requireTeacher(request);
    const body = await request.json().catch(() => {
      throw HttpError.validation({ _: 'Der Anfragekörper ist kein gültiges JSON.' });
    });

    const patient = await updatePatient(actor, patientId, body);
    return NextResponse.json({ patient }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
