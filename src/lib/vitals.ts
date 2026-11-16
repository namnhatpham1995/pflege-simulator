import {
  MEASUREMENT_CATEGORIES,
  categoryForKind,
  type EntryGroup,
  type MeasurementCategory,
  type RecentEntries,
  type VitalEntry,
  type VitalField,
} from '@/lib/types';
import { VITAL_RULES } from '@/lib/validation/vitals';

export const RECENT_ENTRIES_LIMIT = 50;

export function formatVitalValue(kind: VitalField, value: number): string {
  if (VITAL_RULES[kind].kind === 'integer') return String(value);
  return String(value).replace('.', ',');
}

/** The two rows of one blood-pressure save become one list line. */
export function groupEntries(entries: VitalEntry[]): EntryGroup[] {
  const groups = new Map<string, EntryGroup>();
  for (const entry of entries) {
    const existing = groups.get(entry.submissionId);
    if (existing) {
      existing.values[entry.kind] = entry.value;
      continue;
    }
    groups.set(entry.submissionId, {
      submissionId: entry.submissionId,
      category: categoryForKind(entry.kind),
      observedDate: entry.observedDate,
      observedTime: entry.observedTime,
      values: { [entry.kind]: entry.value },
      createdAt: entry.createdAt,
    });
  }
  return [...groups.values()];
}

export function emptyRecentEntries(): RecentEntries {
  return Object.fromEntries(
    MEASUREMENT_CATEGORIES.map((category) => [category.key, [] as EntryGroup[]]),
  ) as RecentEntries;
}

export function recentByCategory(groups: EntryGroup[]): RecentEntries {
  const result = emptyRecentEntries();
  for (const category of MEASUREMENT_CATEGORIES) {
    result[category.key] = groups
      .filter((group) => group.category === category.key)
      .sort((a, b) => {
        if (a.observedDate !== b.observedDate) return a.observedDate < b.observedDate ? 1 : -1;
        if (a.observedTime !== b.observedTime) return a.observedTime < b.observedTime ? 1 : -1;
        return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
      })
      .slice(0, RECENT_ENTRIES_LIMIT);
  }
  return result;
}

export function entriesForCategory(groups: EntryGroup[], category: MeasurementCategory): EntryGroup[] {
  return groups.filter((group) => group.category === category);
}
