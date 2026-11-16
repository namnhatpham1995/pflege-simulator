import Link from 'next/link';
import { formatDe } from '@/lib/date';
import { listPatients } from '@/server/services/patients';

export const metadata = {
  title: 'Patienten – Pflegedokumentation',
};

// The roster is read from the database, never prerendered at build time.
export const dynamic = 'force-dynamic';

export default async function PatientsPage() {
  const patients = await listPatients();

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Fiktive Patienten</h1>
        <p className="text-sm text-ink-muted">
          Wählen Sie einen Patienten. Dashboard, Vitalwerte und Pflegebericht sind für alle
          Besucherinnen und Besucher offen; die Lehrkraft liest nur.
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {patients.map((patient) => (
          <li key={patient.id}>
            <Link
              href={`/patients/${patient.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm shadow-panel hover:border-accent"
            >
              <span>
                <span className="block font-medium text-ink">{patient.displayName}</span>
                <span className="block text-xs text-ink-muted">
                  {patient.dateOfBirth
                    ? `Geburtsdatum: ${formatDe(patient.dateOfBirth)}`
                    : 'Geburtsdatum nicht angegeben'}
                </span>
              </span>
              <span aria-hidden="true" className="text-ink-muted">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
