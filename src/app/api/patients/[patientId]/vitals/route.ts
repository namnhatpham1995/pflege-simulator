import { NextResponse } from 'next/server';
import { HttpError, toErrorResponse } from '@/lib/api-error';
import { assertSameOrigin, requirePatientAccess } from '@/server/services/access';
import { createEntries, getEntriesRange } from '@/server/services/vitals';

interface RouteContext {
  params: Promise<{ patientId: string }>;
}

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const { patientId } = await params;
    await requirePatientAccess(patientId, request);

    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!from || !to) {
      throw HttpError.validation({ from: 'from und to sind erforderlich (JJJJ-MM-TT).' });
    }

    const entries = await getEntriesRange(patientId, from, to);
    return NextResponse.json({ entries }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const { patientId } = await params;
    assertSameOrigin(request);
    const access = await requirePatientAccess(patientId, request);
    const body = await request.json().catch(() => {
      throw HttpError.validation({ _: 'Der Anfragekörper ist kein gültiges JSON.' });
    });

    const created = await createEntries(access.actor, patientId, body);
    return NextResponse.json(created, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
