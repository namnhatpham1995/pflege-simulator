import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-accent">
        Pflegedokumentation – Simulation
      </p>
      <h1 className="text-3xl font-semibold text-ink">Übungssimulator für die Pflegedokumentation</h1>
      <p className="text-base text-ink-muted">
        Zehn fiktive Patienten für die Übung der Vitalwerte und Pflegeberichte. Alle Personen und
        Werte in dieser Anwendung sind erfunden.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/patients"
          className="inline-flex h-11 items-center rounded-md bg-accent px-6 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Start
        </Link>
        <Link href="/login" className="text-sm text-ink-muted underline-offset-4 hover:underline">
          Anmeldung für die Lehrkraft
        </Link>
      </div>
    </main>
  );
}
