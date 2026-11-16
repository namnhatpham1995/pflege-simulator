'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || pending) return;

    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;

      if (!response.ok) {
        setError(payload?.error?.message ?? 'Die Anmeldung ist fehlgeschlagen.');
        return;
      }

      router.replace('/teacher');
      router.refresh();
    } catch {
      setError('Die Anmeldung ist fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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

      {error ? (
        <p role="alert" className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || !password} className="w-full">
        {pending ? 'Anmeldung läuft…' : 'Anmelden'}
      </Button>
    </form>
  );
}
