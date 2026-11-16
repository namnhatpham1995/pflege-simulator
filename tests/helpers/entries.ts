import type { VitalEntry, VitalField } from '@/lib/types';

export function makeEntry(
  id: string,
  kind: VitalField,
  value: number,
  date = '2026-11-12',
  time = '09:15',
  submissionId = id,
): VitalEntry {
  return {
    id,
    patientId: 'p-1',
    kind,
    value,
    observedDate: date,
    observedTime: time,
    submissionId,
    createdAt: `${date}T${time}:00.000Z`,
  };
}
