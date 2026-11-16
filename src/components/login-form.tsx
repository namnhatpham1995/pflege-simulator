'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

type Mode = 'group' | 'teacher';

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('group');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const requiresValue = mode === 'group' ? code.trim().length > 0 : password.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requiresValue || pending) return;

    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'group' ? { mode, code: code.trim() } : { mode, password },
        ),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;

      if (!response.ok) {
        setError(payload?.error?.message ?? 'Die Anmeldung ist fehlgeschlagen.');
        return;
      }

      router.replace('/patients');
      router.refresh();
    } catch {
      setError('Die Anmeldung ist fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Anmeldeart">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'group'}
          onClick={() => {
            setMode('group');
            setError(null);
          }}
          className={`h-9 rounded-md border text-sm font-medium ${
            mode === 'group'
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-line bg-surface text-ink-muted'
          }`}
        >
          Lerngruppe
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'teacher'}
          onClick={() => {
            setMode('teacher');
            setError(null);
          }}
          className={`h-9 rounded-md border text-sm font-medium ${
            mode === 'teacher'
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-line bg-surface text-ink-muted'
          }`}
        >
          Lehrkraft
        </button>
      </div>

      {mode === 'group' ? (
        <Field
          label="Zugangscode der Gruppe"
          htmlFor="access-code"
          hint="Der Code wurde einmalig an die Gruppe ausgegeben."
          required
        >
          <input
            id="access-code"
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            className="h-10 rounded-md border border-line bg-surface px-3 font-mono text-sm tracking-wider text-ink"
          />
        </Field>
      ) : (
        <Field label="Passwort der Lehrkraft" htmlFor="teacher-password" required>
          <input
            id="teacher-password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className="h-10 rounded-md border border-line bg-surface px-3 text-sm text-ink"
          />
        </Field>
      )}

      {error ? (
        <p role="alert" className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || !requiresValue} className="w-full">
        {pending ? 'Anmeldung läuft…' : 'Anmelden'}
      </Button>
    </form>
  );
}
