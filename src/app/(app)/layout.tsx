import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/logout-button';
import type { Actor } from '@/lib/types';
import { requireActor } from '@/server/auth/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let actor: Actor | null = null;
  try {
    actor = await requireActor();
  } catch {
    actor = null;
  }
  if (!actor) redirect('/login');

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              Pflegedokumentation – Simulation
            </p>
            <p className="text-sm font-medium text-ink">{actor.displayName}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/patients" className="text-sm text-ink-muted hover:text-ink">
              Patienten
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
