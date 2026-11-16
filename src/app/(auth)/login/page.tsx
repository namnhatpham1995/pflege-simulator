import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { requireActor } from '@/server/auth/session';

export const metadata = {
  title: 'Anmelden – Pflegedokumentation',
};

export default async function LoginPage() {
  let alreadySignedIn = false;
  try {
    await requireActor();
    alreadySignedIn = true;
  } catch {
    alreadySignedIn = false;
  }
  if (alreadySignedIn) redirect('/patients');

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          Pflegedokumentation – Simulation
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Anmelden</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Lerngruppen melden sich mit ihrem Zugangscode an, die Lehrkraft mit ihrem Passwort.
          Alle Patientinnen und Patienten sind fiktiv.
        </p>
      </div>
      <div className="rounded-lg border border-line bg-surface p-5 shadow-panel">
        <LoginForm />
      </div>
    </main>
  );
}
