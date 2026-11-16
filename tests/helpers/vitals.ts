import type { Requirements, VitalRecord } from '@/lib/types';

export const BASE_REQUIREMENTS: Requirements = {
  systolic: true,
  diastolic: true,
  pulse: true,
  temperature: false,
  weight: false,
  height: false,
  pain: false,
  glucose: false,
};

export interface VitalValuesInput {
  systolic?: number | null;
  diastolic?: number | null;
  pulse?: number | null;
  temperature?: number | null;
  weight?: number | null;
  height?: number | null;
  pain?: number | null;
  glucose?: number | null;
}

export function makeRecord(
  date: string,
  values: VitalValuesInput,
  version = 1,
): VitalRecord {
  return {
    id: `v-${date}`,
    patientId: 'p-1',
    date,
    systolicMmhg: values.systolic ?? null,
    diastolicMmhg: values.diastolic ?? null,
    pulseBpm: values.pulse ?? null,
    temperatureC: values.temperature ?? null,
    weightKg: values.weight ?? null,
    heightCm: values.height ?? null,
    painScore: values.pain ?? null,
    glucoseMgDl: values.glucose ?? null,
    version,
    createdAt: '2026-11-10T08:00:00.000Z',
    updatedAt: '2026-11-10T08:00:00.000Z',
  };
}
