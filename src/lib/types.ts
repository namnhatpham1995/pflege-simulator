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

export const VITAL_FIELD_COLUMNS = {
  systolic: 'systolicMmhg',
  diastolic: 'diastolicMmhg',
  pulse: 'pulseBpm',
  temperature: 'temperatureC',
  weight: 'weightKg',
  height: 'heightCm',
  pain: 'painScore',
  glucose: 'glucoseMgDl',
} as const satisfies Record<VitalField, string>;

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
  /** Only set for group actors. */
  patientId?: string;
}

export interface PatientSummary {
  id: string;
  displayName: string;
}

export interface VitalRecord {
  id: string;
  patientId: string;
  date: string;
  systolicMmhg: number | null;
  diastolicMmhg: number | null;
  pulseBpm: number | null;
  temperatureC: number | null;
  weightKg: number | null;
  heightCm: number | null;
  painScore: number | null;
  glucoseMgDl: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type Requirements = Record<VitalField, boolean>;

/** Fields a patient expects unless the teacher overrides them. */
export const DEFAULT_EXPECTED_FIELDS: readonly VitalField[] = ['systolic', 'diastolic', 'pulse'];

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
