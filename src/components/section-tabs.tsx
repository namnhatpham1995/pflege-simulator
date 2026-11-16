'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const SECTIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'vitalwerte', label: 'Vitalwerte' },
  { key: 'pflegebericht', label: 'Pflegebericht' },
] as const;

export function SectionTabs({ patientId }: { patientId: string }) {
  const pathname = usePathname() ?? '';

  return (
    <nav aria-label="Bereiche" className="flex gap-1 border-b border-line">
      {SECTIONS.map((section) => {
        const href = `/patients/${patientId}/${section.key}`;
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={section.key}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium',
              isActive
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
