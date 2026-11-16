import {
  VITAL_FIELDS,
  VITAL_FIELD_COLUMNS,
  type VitalField,
  type VitalRecord,
} from '@/lib/types';
import type { VitalsValuesPatch } from '@/lib/validation/vitals';

export type VitalValues = Record<VitalField, number | null>;

export function emptyValues(): VitalValues {
  return Object.fromEntries(VITAL_FIELDS.map((field) => [field, null])) as VitalValues;
}

export function valuesFromRecord(record: VitalRecord): VitalValues {
  return Object.fromEntries(
    VITAL_FIELDS.map((field) => [field, record[VITAL_FIELD_COLUMNS[field]] ?? null]),
  ) as VitalValues;
}

/** Omitted key = unchanged, explicit null = cleared. */
export function mergeValues(current: VitalValues, patch: VitalsValuesPatch): VitalValues {
  const merged = { ...current };
  for (const field of VITAL_FIELDS) {
    if (!(field in patch)) continue;
    const value = patch[field];
    if (value === undefined) continue;
    merged[field] = value;
  }
  return merged;
}

export interface FieldChange {
  field: VitalField;
  from: number | null;
  to: number | null;
}

export function changedFields(before: VitalValues, after: VitalValues): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of VITAL_FIELDS) {
    if (before[field] !== after[field]) {
      changes.push({ field, from: before[field], to: after[field] });
    }
  }
  return changes;
}

export function columnsFromValues(values: VitalValues) {
  return {
    systolicMmhg: values.systolic,
    diastolicMmhg: values.diastolic,
    pulseBpm: values.pulse,
    temperatureC: values.temperature,
    weightKg: values.weight,
    heightCm: values.height,
    painScore: values.pain,
    glucoseMgDl: values.glucose,
  };
}
