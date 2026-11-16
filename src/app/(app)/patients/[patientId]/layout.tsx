import { notFound, redirect } from 'next/navigation';
import { SectionTabs } from '@/components/section-tabs';
import { HttpError } from '@/lib/api-error';
import { requirePatientAccess } from '@/server/services/access';

export default async function PatientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-surface p-4 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Fiktiver Patient
        </p>
        <h1 className="text-xl font-semibold text-ink">{access.patient.displayName}</h1>
        <p className="text-xs text-ink-muted">Zugang: {access.actor.displayName}</p>
      </div>
      <SectionTabs patientId={patientId} />
      {children}
    </div>
  );
}
