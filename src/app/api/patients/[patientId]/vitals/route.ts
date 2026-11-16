import { NextResponse } from 'next/server';
import { HttpError, toErrorResponse } from '@/lib/api-error';
import { requirePatientAccess } from '@/server/services/access';
import { getVitalsRange } from '@/server/services/vitals';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
): Promise<Response> {
  try {
    const { patientId } = await params;
    await requirePatientAccess(patientId, request);

    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!from || !to) {
      throw HttpError.validation({ from: 'from und to sind erforderlich (JJJJ-MM-TT).' });
    }

    const result = await getVitalsRange(patientId, from, to);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
