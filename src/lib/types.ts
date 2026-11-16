export const SESSION_COOKIE_NAME = 'pflege_session';

export const VITAL_FIELDS = [
  'systolic',
  'diastolic',
  'pulse',
  'temperature',
  'weight',
  'height',
  'pain',
  'glucose',
] as const;

export type VitalField = (typeof VITAL_FIELDS)[number];

export const VITAL_FIELD_LABELS: Record<VitalField, string> = {
  systolic: 'Blutdruck systolisch',
  diastolic: 'Blutdruck diastolisch',
  pulse: 'Puls',
  temperature: 'Temperatur',
  weight: 'Gewicht',
  height: 'Größe',
  pain: 'Schmerzen',
  glucose: 'Blutzucker',
};

export const VITAL_FIELD_UNITS: Record<VitalField, string> = {
  systolic: 'mmHg',
  diastolic: 'mmHg',
  pulse: 'Schläge/min',
  temperature: '°C',
  weight: 'kg',
  height: 'cm',
  pain: '0–10',
  glucose: 'mg/dL',
};

/** The four kinds drawn on the dashboard chart. */
export const CHARTED_KINDS: readonly VitalField[] = [
  'systolic',
  'diastolic',
  'pulse',
  'temperature',
];

export type MeasurementCategory =
  | 'blutdruck'
  | 'puls'
  | 'temperatur'
  | 'gewicht'
  | 'groesse'
  | 'schmerzen'
  | 'blutzucker';

export interface CategoryDefinition {
  key: MeasurementCategory;
  label: string;
  fields: readonly VitalField[];
}

/** One input tab per category; Blutdruck is the only pair. */
export const MEASUREMENT_CATEGORIES = [
  { key: 'blutdruck', label: 'Blutdruck', fields: ['systolic', 'diastolic'] },
  { key: 'puls', label: 'Puls', fields: ['pulse'] },
  { key: 'temperatur', label: 'Temperatur', fields: ['temperature'] },
  { key: 'gewicht', label: 'Gewicht', fields: ['weight'] },
  { key: 'groesse', label: 'Größe', fields: ['height'] },
  { key: 'schmerzen', label: 'Schmerzen', fields: ['pain'] },
  { key: 'blutzucker', label: 'Blutzucker', fields: ['glucose'] },
] as const satisfies readonly CategoryDefinition[];

export function categoryForKind(kind: VitalField): MeasurementCategory {
  const category = MEASUREMENT_CATEGORIES.find((entry) =>
    (entry.fields as readonly VitalField[]).includes(kind),
  );
  if (!category) throw new Error(`Unbekannte Messart: ${kind}`);
  return category.key;
}

export function categoryDefinition(key: MeasurementCategory): CategoryDefinition {
  const category = MEASUREMENT_CATEGORIES.find((entry) => entry.key === key);
  if (!category) throw new Error(`Unbekannte Kategorie: ${key}`);
  return category;
}

export const SHIFTS = ['frueh', 'spaet', 'nacht'] as const;
export type Shift = (typeof SHIFTS)[number];

export const SHIFT_LABELS: Record<Shift, string> = {
  frueh: 'Früh',
  spaet: 'Spät',
  nacht: 'Nacht',
};

export type ActorType = 'group' | 'teacher';

export interface Actor {
  type: ActorType;
  id: string;
  displayName: string;
  /** Only set for the anonymous student actor of a patient workspace. */
  patientId?: string;
}

export interface PatientSummary {
  id: string;
  displayName: string;
  dateOfBirth: string | null;
}

export interface VitalEntry {
  id: string;
  patientId: string;
  kind: VitalField;
  value: number;
  observedDate: string;
  observedTime: string;
  submissionId: string;
  createdAt: string;
}

/** The rows of one save, shown in the Vitalwerte tab as one line. */
export interface EntryGroup {
  submissionId: string;
  category: MeasurementCategory;
  observedDate: string;
  observedTime: string;
  values: Partial<Record<VitalField, number>>;
  createdAt: string;
}

export type RecentEntries = Record<MeasurementCategory, EntryGroup[]>;

export interface CareReport {
  id: string;
  patientId: string;
  groupId: string | null;
  observedDate: string;
  observedTime: string;
  shift: Shift;
  body: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CareReportRevision {
  id: string;
  reportId: string;
  version: number;
  body: string;
  actorType: ActorType;
  actorId: string;
  createdAt: string;
}

export interface ChangeRecord {
  field: string;
  from: string | number | null;
  to: string | number | null;
}

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'ORIGIN'
  | 'INTERNAL';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    fields?: Record<string, string>;
  };
}
