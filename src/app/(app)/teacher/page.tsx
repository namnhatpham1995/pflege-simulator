import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ResetClassDataButton } from '@/components/reset-class-data-button';
import { formatDe } from '@/lib/date';
import { requireActor } from '@/server/auth/session';
import { listPatients } from '@/server/services/patients';
import type { Actor } from '@/lib/types';

export const metadata = {
  title: 'Lehrkraft-Konsole – Pflegedokumentation',
};

export const dynamic = 'force-dynamic';

export default async function TeacherPage() {
  let actor: Actor | null = null;
  try {
    actor = await requireActor();
  } catch {
    actor = null;
  }
  if (!actor) redirect('/login');
  if (actor.type !== 'teacher') notFound();

  const patients = await listPatients();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Lehrkraft-Konsole</h1>
        <p className="text-sm text-ink-muted">
          Lesender Zugriff auf alle fiktiven Patienten. Die Lehrkraft kann Messwerte und
          Pflegeberichte weder anlegen noch ändern; Namen und Geburtsdaten lassen sich im
          Patientenbereich bearbeiten.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {patients.map((patient) => (
          <div
            key={patient.id}
            className="rounded-lg border border-line bg-surface p-3 shadow-panel"
          >
            <p className="text-sm font-medium text-ink">{patient.displayName}</p>
            <p className="text-xs text-ink-muted">
              {patient.dateOfBirth
                ? `Geburtsdatum: ${formatDe(patient.dateOfBirth)}`
                : 'Geburtsdatum nicht angegeben'}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <Link href={`/patients/${patient.id}/dashboard`} className="text-accent hover:underline">
                Dashboard ansehen
              </Link>
              <Link
                href={`/patients/${patient.id}/pflegebericht`}
                className="text-accent hover:underline"
              >
                Pflegeberichte ansehen
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-danger bg-surface p-4 shadow-panel">
        <h2 className="text-sm font-semibold text-ink">Klassendaten zurücksetzen</h2>
        <p className="mb-2 text-xs text-ink-muted">
          Löscht Messwerte, Pflegeberichte, frühere Fassungen und das Protokoll. Patienten mit
          ihren Namen und Geburtsdaten bleiben erhalten. Am Semesterende gedacht.
        </p>
        <ResetClassDataButton />
      </div>
    </section>
  );
}
