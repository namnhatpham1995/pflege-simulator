'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
      setPending(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleLogout} disabled={pending}>
      {pending ? 'Abmelden…' : 'Abmelden'}
    </Button>
  );
}
