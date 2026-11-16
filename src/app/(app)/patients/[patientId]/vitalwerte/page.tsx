import { notFound } from 'next/navigation';
import { VitalwertePanel } from '@/components/vitalwerte-panel';
import { HttpError } from '@/lib/api-error';
import { requirePatientAccess } from '@/server/services/access';
import { listRecentEntries } from '@/server/services/vitals';

export const metadata = {
  title: 'Vitalwerte – Pflegedokumentation',
};

export default async function VitalwertePage({
  params,
}: {
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

  const recent = await listRecentEntries(patientId);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Vitalwerte</h2>
        <p className="text-sm text-ink-muted">
          Eine Kategorie wählen, Wert, Tag und Uhrzeit eintragen und ausdrücklich speichern.
          Gespeicherte Einträge lassen sich löschen, nicht bearbeiten.
        </p>
      </div>

      <VitalwertePanel
        patientId={patientId}
        recent={recent}
        canWrite={access.actor.type === 'group'}
      />
    </section>
  );
}
