import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ExpectedFieldsEditor, ResetClassDataButton } from '@/components/expected-fields-editor';
import { HttpError } from '@/lib/api-error';
import { requireActor } from '@/server/auth/session';
import { getRequirementPolicy } from '@/server/services/requirements';
import { listAuthorisedPatients } from '@/server/services/patients';
import type { Actor } from '@/lib/types';

export const metadata = {
  title: 'Lehrkraft-Konsole – Pflegedokumentation',
};

export default async function TeacherPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  let actor: Actor | null = null;
  try {
    actor = await requireActor();
  } catch {
    actor = null;
  }
  if (!actor) redirect('/login');
  if (actor.type !== 'teacher') notFound();

  const patients = await listAuthorisedPatients(actor);
  const { patient: requestedPatient } = await searchParams;
  const selectedId = requestedPatient ?? patients[0]?.id ?? null;
  const requirements = selectedId ? await getRequirementPolicy(selectedId) : null;
  const selectedPatient = patients.find((patient) => patient.id === selectedId) ?? null;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Lehrkraft-Konsole</h1>
        <p className="text-sm text-ink-muted">
          Lesender Zugriff auf alle fiktiven Patienten. Die Lehrkraft kann keine Einträge ändern,
          aber festlegen, welche Messwerte pro Patient erwartet werden.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {patients.map((patient) => (
          <div
            key={patient.id}
            className="rounded-lg border border-line bg-surface p-3 shadow-panel"
          >
            <p className="text-sm font-medium text-ink">{patient.displayName}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <Link
                href={`/patients/${patient.id}/vitalwerte`}
                className="text-accent hover:underline"
              >
                Vitalwerte ansehen
              </Link>
              <Link
                href={`/patients/${patient.id}/pflegebericht`}
                className="text-accent hover:underline"
              >
                Pflegeberichte ansehen
              </Link>
              <Link href={`/teacher?patient=${patient.id}`} className="text-ink-muted hover:underline">
                Erwartungen
              </Link>
            </div>
          </div>
        ))}
      </div>

      {selectedPatient && requirements ? (
        <div className="rounded-lg border border-line bg-surface p-4 shadow-panel">
          <h2 className="text-lg font-semibold text-ink">
            Erwartete Messwerte – {selectedPatient.displayName}
          </h2>
          <p className="mb-3 text-sm text-ink-muted">
            Ist ein Feld erwartet, wird ein leerer Wert rot markiert und im Hinweis genannt.
            Gewicht und Größe sind standardmäßig optional.
          </p>
          <ExpectedFieldsEditor
            patientId={selectedPatient.id}
            initialRequirements={requirements}
          />
        </div>
      ) : null}

      <div className="rounded-lg border border-danger bg-surface p-4 shadow-panel">
        <h2 className="text-sm font-semibold text-ink">Klassendaten zurücksetzen</h2>
        <p className="mb-2 text-xs text-ink-muted">
          Löscht Vitalwerte, Pflegeberichte, frühere Fassungen und das Protokoll. Patienten,
          Gruppen, Zugangscodes und Erwartungen bleiben erhalten. Am Semesterende gedacht.
        </p>
        <ResetClassDataButton />
      </div>
    </section>
  );
}
