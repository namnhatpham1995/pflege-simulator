import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api-error';
import { listPatients } from '@/server/services/patients';

export async function GET(): Promise<Response> {
  try {
    const patients = await listPatients();
    return NextResponse.json({ patients }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
