'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { buildWindowDates } from '@/lib/chart-segments';
import { addDays } from '@/lib/date';
import type { Requirements, VitalField, VitalRecord } from '@/lib/types';
import { emptyValues, valuesFromRecord, type VitalValues } from '@/lib/vitals';

export const WINDOW_BEFORE = 7;
export const WINDOW_AFTER = 6;

export interface ConflictInfo {
  date: string;
  current: VitalRecord | null;
}

interface VitalViewValue {
  patientId: string;
  selectedDate: string;
  hoveredDate: string | null;
  activeDate: string;
  windowDates: string[];
  records: Record<string, VitalRecord>;
  requirements: Requirements;
  pending: boolean;
  error: string | null;
  conflict: ConflictInfo | null;
  activeValues: VitalValues;
  selectDate: (date: string) => void;
  hoverDate: (date: string | null) => void;
  saveField: (field: VitalField, value: number | null) => Promise<boolean>;
  clearConflict: () => void;
  reload: () => Promise<void>;
}

const VitalViewContext = createContext<VitalViewValue | null>(null);

function byDate(records: VitalRecord[]): Record<string, VitalRecord> {
  return Object.fromEntries(records.map((record) => [record.date, record]));
}

export interface VitalViewProviderProps {
  patientId: string;
  initialDate: string;
  initialRecords: VitalRecord[];
  initialRequirements: Requirements;
  children: ReactNode;
}

export function VitalViewProvider({
  patientId,
  initialDate,
  initialRecords,
  initialRequirements,
  children,
}: VitalViewProviderProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [records, setRecords] = useState<Record<string, VitalRecord>>(() => byDate(initialRecords));
  const [requirements, setRequirements] = useState<Requirements>(initialRequirements);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);

  const requestKey = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const windowDates = useMemo(
    () => buildWindowDates(selectedDate, { before: WINDOW_BEFORE, after: WINDOW_AFTER }),
    [selectedDate],
  );

  const activeDate = hoveredDate ?? selectedDate;
  const activeValues = records[activeDate]
    ? valuesFromRecord(records[activeDate]!)
    : emptyValues();

  const loadWindow = useCallback(
    async (date: string) => {
      const key = requestKey.current + 1;
      requestKey.current = key;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const from = addDays(date, -WINDOW_BEFORE);
      const to = addDays(date, WINDOW_AFTER);
      setPending(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/patients/${patientId}/vitals?from=${from}&to=${to}`,
          { signal: controller.signal },
        );
        if (key !== requestKey.current) return;
        if (!response.ok) {
          setError('Die Werte konnten nicht geladen werden.');
          return;
        }
        const payload = (await response.json()) as {
          records: VitalRecord[];
          requirements: Requirements;
        };
        setRecords(byDate(payload.records));
        setRequirements(payload.requirements);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError('Die Werte konnten nicht geladen werden.');
      } finally {
        if (key === requestKey.current) setPending(false);
      }
    },
    [patientId],
  );

  const selectDate = useCallback(
    (date: string) => {
      setSelectedDate(date);
      setHoveredDate(null);
      setConflict(null);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `${window.location.pathname}?date=${date}`);
      }
      void loadWindow(date);
    },
    [loadWindow],
  );

  const hoverDate = useCallback((date: string | null) => {
    setHoveredDate(date);
  }, []);

  const saveField = useCallback(
    async (field: VitalField, value: number | null): Promise<boolean> => {
      const record = records[selectedDate];
      const version = record?.version ?? 0;
      setError(null);
      setConflict(null);

      try {
        const response = await fetch(`/api/patients/${patientId}/vitals/${selectedDate}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ version, values: { [field]: value } }),
        });

        if (response.status === 409) {
          const payload = (await response.json().catch(() => null)) as
            | { current?: { record: VitalRecord | null } }
            | null;
          setConflict({ date: selectedDate, current: payload?.current?.record ?? null });
          return false;
        }

        if (!response.ok) {
          setError('Der Wert konnte nicht gespeichert werden.');
          return false;
        }

        const payload = (await response.json()) as { record: VitalRecord; version: number };
        setRecords((current) => ({ ...current, [selectedDate]: payload.record }));
        // Reload the visible window so neighbouring points and warnings stay true.
        void loadWindow(selectedDate);
        return true;
      } catch {
        setError('Der Wert konnte nicht gespeichert werden.');
        return false;
      }
    },
    [loadWindow, patientId, records, selectedDate],
  );

  const clearConflict = useCallback(() => setConflict(null), []);

  const reload = useCallback(() => loadWindow(selectedDate), [loadWindow, selectedDate]);

  const value: VitalViewValue = {
    patientId,
    selectedDate,
    hoveredDate,
    activeDate,
    windowDates,
    records,
    requirements,
    pending,
    error,
    conflict,
    activeValues,
    selectDate,
    hoverDate,
    saveField,
    clearConflict,
    reload,
  };

  return <VitalViewContext.Provider value={value}>{children}</VitalViewContext.Provider>;
}

export function useVitalView(): VitalViewValue {
  const value = useContext(VitalViewContext);
  if (!value) throw new Error('useVitalView muss innerhalb des VitalViewProvider verwendet werden.');
  return value;
}
