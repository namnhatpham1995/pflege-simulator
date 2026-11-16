import { notFound, redirect } from 'next/navigation';
import { HttpError } from '@/lib/api-error';
import { addDays, isValidCalendarDate, todayInBerlin } from '@/lib/date';
import { requirePatientAccess } from '@/server/services/access';
import { getVitalsRange } from '@/server/services/vitals';
import { WINDOW_AFTER, WINDOW_BEFORE } from '@/lib/chart-segments';
import { VitalViewProvider } from '@/state/vital-view';
import { VitalWorkspace } from './vital-workspace';

export const metadata = {
  title: 'Vitalwerte – Pflegedokumentation',
};

export default async function VitalwertePage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { patientId } = await params;

  try {
    await requirePatientAccess(patientId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect('/login');
    if (error instanceof HttpError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  const { date } = await searchParams;
  const selectedDate = date && isValidCalendarDate(date) ? date : todayInBerlin();

  const { records, requirements } = await getVitalsRange(
    patientId,
    addDays(selectedDate, -WINDOW_BEFORE),
    addDays(selectedDate, WINDOW_AFTER),
  );

  return (
    <VitalViewProvider
      patientId={patientId}
      initialDate={selectedDate}
      initialRecords={records}
      initialRequirements={requirements}
    >
      <VitalWorkspace />
    </VitalViewProvider>
  );
}
