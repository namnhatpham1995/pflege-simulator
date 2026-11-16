import Link from 'next/link';
import { requireActor } from '@/server/auth/session';
import { listAuthorisedPatients } from '@/server/services/patients';

export const metadata = {
  title: 'Patienten – Pflegedokumentation',
};

export default async function PatientsPage() {
  const actor = await requireActor();
  const patients = await listAuthorisedPatients(actor);

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">
          {actor.type === 'teacher' ? 'Alle fiktiven Patienten' : 'Ihr Patient'}
        </h1>
        <p className="text-sm text-ink-muted">
          {actor.type === 'teacher'
            ? 'Die Lehrkraft hat lesenden Zugriff auf alle zehn Patienten.'
            : 'Ihre Gruppe dokumentiert ausschließlich für den zugeordneten Patienten.'}
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {patients.map((patient) => (
          <li key={patient.id}>
            <Link
              href={`/patients/${patient.id}/vitalwerte`}
              className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 text-sm font-medium text-ink shadow-panel hover:border-accent"
            >
              <span>{patient.displayName}</span>
              <span aria-hidden="true" className="text-ink-muted">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {patients.length === 0 ? (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
          Für dieses Konto ist kein Patient freigegeben. Bitte an die Lehrkraft wenden.
        </p>
      ) : null}
    </section>
  );
}
