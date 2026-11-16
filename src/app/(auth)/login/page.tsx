import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { requireActor } from '@/server/auth/session';

export const metadata = {
  title: 'Lehrkraft-Anmeldung – Pflegedokumentation',
};

export default async function LoginPage() {
  let alreadySignedIn = false;
  try {
    await requireActor();
    alreadySignedIn = true;
  } catch {
    alreadySignedIn = false;
  }
  if (alreadySignedIn) redirect('/teacher');

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          Pflegedokumentation – Simulation
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Anmeldung für die Lehrkraft</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Studierende starten ohne Anmeldung über <strong>Start</strong>. Die Lehrkraft meldet sich
          hier mit ihrem Passwort an und liest die Dokumentation nur mit.
        </p>
      </div>
      <div className="rounded-lg border border-line bg-surface p-5 shadow-panel">
        <LoginForm />
      </div>
    </main>
  );
}
