import { NextResponse } from 'next/server';
import { parseJsonBody, toErrorResponse } from '@/lib/api-error';
import { resetRequestSchema } from '@/lib/validation/reset';
import { assertSameOrigin, requireTeacher } from '@/server/services/access';
import { resetClassData } from '@/server/services/reset';

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const actor = await requireTeacher(request);
    const body = await parseJsonBody(request, resetRequestSchema);
    const deleted = await resetClassData(actor, body.confirm);
    return NextResponse.json({ deleted }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
