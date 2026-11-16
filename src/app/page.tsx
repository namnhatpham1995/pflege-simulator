import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-accent">
        Pflegedokumentation – Simulation
      </p>
      <h1 className="text-3xl font-semibold text-ink">Übungssimulator für die Pflegedokumentation</h1>
      <p className="text-base text-ink-muted">
        Zehn Lerngruppen dokumentieren Vitalwerte und Pflegeberichte für zehn fiktive Patienten.
        Alle Personen und Werte in dieser Anwendung sind erfunden.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/login"
          className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-blue-800"
        >
          Anmelden
        </Link>
        <span className="inline-flex h-10 items-center rounded-md border border-line px-4 text-sm text-ink-muted">
          Zugangscode der Gruppe verwenden
        </span>
      </div>
    </main>
  );
}
