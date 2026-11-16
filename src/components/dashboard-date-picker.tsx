'use client';

import { useRouter } from 'next/navigation';
import { DatePartsPicker } from '@/components/date-parts-picker';
import type { DashboardView } from '@/lib/date';

export interface DashboardDatePickerProps {
  patientId: string;
  value: string;
  view: DashboardView;
}

export function DashboardDatePicker({ patientId, value, view }: DashboardDatePickerProps) {
  const router = useRouter();

  return (
    <DatePartsPicker
      value={value}
      label="Datum"
      onChange={(date) => {
        router.push(`/patients/${patientId}/dashboard?view=${view}&date=${date}`);
      }}
    />
  );
}
