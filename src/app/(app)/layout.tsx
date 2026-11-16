import Link from 'next/link';
import { LogoutButton } from '@/components/logout-button';
import type { Actor } from '@/lib/types';
import { requireActor } from '@/server/auth/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let teacher: Actor | null = null;
  try {
    const actor = await requireActor();
    teacher = actor.type === 'teacher' ? actor : null;
  } catch {
    teacher = null;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <Link
              href="/"
              className="text-xs font-semibold uppercase tracking-wide text-accent hover:underline"
            >
              Pflegedokumentation – Simulation
            </Link>
            <p className="text-sm font-medium text-ink">
              {teacher ? teacher.displayName : 'Anonymer Übungsbetrieb'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/patients" className="text-sm text-ink-muted hover:text-ink">
              Patienten
            </Link>
            {teacher ? (
              <>
                <Link href="/teacher" className="text-sm text-ink-muted hover:text-ink">
                  Lehrkraft-Konsole
                </Link>
                <LogoutButton />
              </>
            ) : (
              <Link href="/login" className="text-sm text-ink-muted hover:text-ink">
                Lehrkraft-Anmeldung
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
