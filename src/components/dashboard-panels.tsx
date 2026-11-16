'use client';

import { EntryHoverProvider } from '@/components/entry-hover';
import { EntryRows } from '@/components/entry-rows';
import { VitalChart } from '@/components/vital-chart';
import type { VitalEntry } from '@/lib/types';

export interface DashboardPanelsProps {
  entries: VitalEntry[];
  from: string;
  totalMinutes: number;
  label: string;
}

export function DashboardPanels({ entries, from, totalMinutes, label }: DashboardPanelsProps) {
  return (
    <EntryHoverProvider>
      <div className="space-y-4">
        <div className="rounded-lg border border-line bg-surface p-3 shadow-panel">
          <VitalChart entries={entries} from={from} totalMinutes={totalMinutes} label={label} />
        </div>
        <EntryRows entries={entries} />
      </div>
    </EntryHoverProvider>
  );
}
