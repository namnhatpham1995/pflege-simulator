'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

/** The entry ids behind the hovered value box; a blood-pressure box carries two. */
export type HoveredIds = readonly string[];

const NONE: HoveredIds = [];

interface EntryHoverValue {
  hoveredIds: HoveredIds;
  setHoveredIds: (ids: HoveredIds) => void;
  clearHovered: () => void;
  toggleHovered: (ids: HoveredIds) => void;
}

const EntryHoverContext = createContext<EntryHoverValue | null>(null);

export function EntryHoverProvider({ children }: { children: ReactNode }) {
  const [hoveredIds, setHoveredIds] = useState<HoveredIds>(NONE);
  const clearHovered = useCallback(() => setHoveredIds(NONE), []);

  // A tap outside any value box dismisses the label and the highlight.
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-entry-box]')) setHoveredIds(NONE);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const toggleHovered = useCallback((ids: HoveredIds) => {
    setHoveredIds((current) => (current.join('|') === ids.join('|') ? NONE : ids));
  }, []);

  return (
    <EntryHoverContext.Provider value={{ hoveredIds, setHoveredIds, clearHovered, toggleHovered }}>
      {children}
    </EntryHoverContext.Provider>
  );
}

export function useEntryHover(): EntryHoverValue {
  const value = useContext(EntryHoverContext);
  if (!value) throw new Error('useEntryHover muss innerhalb des EntryHoverProvider verwendet werden.');
  return value;
}
