'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

interface EntryHoverValue {
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  toggleHovered: (id: string) => void;
}

const EntryHoverContext = createContext<EntryHoverValue | null>(null);

export function EntryHoverProvider({ children }: { children: ReactNode }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // A tap outside any value box dismisses the label and the highlight.
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-entry-box]')) setHoveredId(null);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const toggleHovered = useCallback((id: string) => {
    setHoveredId((current) => (current === id ? null : id));
  }, []);

  return (
    <EntryHoverContext.Provider value={{ hoveredId, setHoveredId, toggleHovered }}>
      {children}
    </EntryHoverContext.Provider>
  );
}

export function useEntryHover(): EntryHoverValue {
  const value = useContext(EntryHoverContext);
  if (!value) throw new Error('useEntryHover muss innerhalb des EntryHoverProvider verwendet werden.');
  return value;
}
