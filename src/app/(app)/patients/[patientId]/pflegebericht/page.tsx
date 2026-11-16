import { notFound, redirect } from 'next/navigation';
import { CareReportForm } from '@/components/care-report-form';
import { CareReportList } from '@/components/care-report-list';
import { HttpError } from '@/lib/api-error';
import { nowInBerlin } from '@/lib/date';
import { requirePatientAccess } from '@/server/services/access';
import { listReports } from '@/server/services/reports';

export const metadata = {
  title: 'Pflegebericht – Pflegedokumentation',
};

export default async function PflegeberichtPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;

  let access;
  try {
    access = await requirePatientAccess(patientId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect('/login');
    if (error instanceof HttpError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  const [reports, now] = await Promise.all([listReports(patientId), Promise.resolve(nowInBerlin())]);
  const canWrite = access.actor.type === 'group';

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-ink">Pflegebericht</h2>
        <p className="text-sm text-ink-muted">
          Datum, Uhrzeit, Schicht und freier Berichtstext. Mehrere Einträge pro Tag und Schicht sind
          erlaubt; frühere Fassungen bleiben im Verlauf erhalten.
        </p>
      </div>

      {canWrite ? (
        <CareReportForm patientId={patientId} defaultDate={now.date} defaultTime={now.time} />
      ) : (
        <p className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-muted">
          Die Lehrkraft hat nur lesenden Zugriff auf die Pflegeberichte.
        </p>
      )}

      <CareReportList patientId={patientId} reports={reports} />
    </section>
  );
}
