import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api-error';
import { requireActor } from '@/server/auth/session';
import { listAuthorisedPatients } from '@/server/services/patients';

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const patients = await listAuthorisedPatients(actor);
    return NextResponse.json({ patients }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
