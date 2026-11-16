'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RESET_CONFIRMATION } from '@/lib/validation/reset';

export function ResetClassDataButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    if (!window.confirm('Alle Messwerte, Pflegeberichte und Protokolle löschen?')) return;
    setPending(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/reset-class-data', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: RESET_CONFIRMATION }),
      });
      if (!response.ok) {
        setError('Das Zurücksetzen ist fehlgeschlagen.');
        return;
      }
      const payload = (await response.json()) as {
        deleted: { entries: number; reports: number; revisions: number; audit: number };
      };
      setResult(
        `Gelöscht: ${payload.deleted.entries} Messwerte, ${payload.deleted.reports} Pflegeberichte, ${payload.deleted.revisions} Fassungen.`,
      );
      router.refresh();
    } catch {
      setError('Das Zurücksetzen ist fehlgeschlagen.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="danger" size="sm" onClick={() => void reset()} disabled={pending}>
        {pending ? 'Wird zurückgesetzt…' : 'Klassendaten zurücksetzen'}
      </Button>
      {result ? <p className="text-xs text-ink-muted">{result}</p> : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
