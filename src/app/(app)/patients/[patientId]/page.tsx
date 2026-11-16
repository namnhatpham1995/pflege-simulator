import { redirect } from 'next/navigation';

export default async function PatientLandingPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  redirect(`/patients/${patientId}/dashboard`);
}
