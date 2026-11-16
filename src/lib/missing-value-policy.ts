import { VITAL_FIELDS, type Requirements, type VitalField } from '@/lib/types';
import { emptyValues, type VitalValues } from '@/lib/vitals';

/**
 * Expected but empty is a fault; optional and empty is not. The policy is the
 * server's requirement set, never computed from the chart.
 */
export function getMissingFields(
  values: VitalValues | null,
  requirements: Requirements,
): VitalField[] {
  const present = values ?? emptyValues();
  return VITAL_FIELDS.filter((field) => requirements[field] && present[field] === null);
}
