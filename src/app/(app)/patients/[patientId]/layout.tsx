import { notFound } from 'next/navigation';
import { PatientHeader } from '@/components/patient-header';
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
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="space-y-4">
      <PatientHeader
        patient={access.patient}
        canEdit={access.actor.type === 'teacher'}
      />
      <SectionTabs patientId={patientId} />
      {children}
    </div>
  );
}
