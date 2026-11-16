import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core';

/**
 * All tables and indexes are created by migration 0000. Later groups must not
 * add or edit migrations; a needed column is a foundation change request.
 */

export const patients = sqliteTable('patients', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  createdAt: text('created_at').notNull(),
});

export const studentGroups = sqliteTable(
  'student_groups',
  {
    id: text('id').primaryKey(),
    displayName: text('display_name').notNull(),
    patientId: text('patient_id')
      .notNull()
      .unique()
      .references(() => patients.id),
    accessCodeHash: text('access_code_hash').notNull(),
    isActive: integer('is_active').notNull().default(1),
  },
  (t) => [check('student_groups_is_active_check', sql`${t.isActive} in (0, 1)`)],
);

export const sessions = sqliteTable(
  'sessions',
  {
    idHash: text('id_hash').primaryKey(),
    actorType: text('actor_type', { enum: ['group', 'teacher'] }).notNull(),
    actorId: text('actor_id').notNull(),
    createdAt: text('created_at').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
    expiresAt: text('expires_at').notNull(),
  },
  (t) => [
    check('sessions_actor_type_check', sql`${t.actorType} in ('group', 'teacher')`),
    index('sessions_expires_at').on(t.expiresAt),
  ],
);

export const loginAttempts = sqliteTable(
  'login_attempts',
  {
    key: text('key').notNull(),
    windowStart: text('window_start').notNull(),
    count: integer('count').notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const vitalDailyRecords = sqliteTable(
  'vital_daily_records',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    date: text('date').notNull(),
    systolicMmhg: integer('systolic_mmhg'),
    diastolicMmhg: integer('diastolic_mmhg'),
    pulseBpm: integer('pulse_bpm'),
    temperatureC: real('temperature_c'),
    weightKg: real('weight_kg'),
    heightCm: real('height_cm'),
    painScore: integer('pain_score'),
    glucoseMgDl: integer('glucose_mg_dl'),
    version: integer('version').notNull().default(1),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    unique('vital_daily_records_patient_date_unique').on(t.patientId, t.date),
    check(
      'vital_daily_records_pain_check',
      sql`${t.painScore} is null or (${t.painScore} between 0 and 10)`,
    ),
    check('vital_daily_records_version_check', sql`${t.version} >= 1`),
  ],
);

export const measurementRequirements = sqliteTable(
  'measurement_requirements',
  {
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    field: text('field', {
      enum: [
        'systolic',
        'diastolic',
        'pulse',
        'temperature',
        'weight',
        'height',
        'pain',
        'glucose',
      ],
    }).notNull(),
    isExpected: integer('is_expected').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.patientId, t.field] }),
    check('measurement_requirements_is_expected_check', sql`${t.isExpected} in (0, 1)`),
  ],
);

export const careReports = sqliteTable(
  'care_reports',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    groupId: text('group_id').references(() => studentGroups.id),
    observedDate: text('observed_date').notNull(),
    observedTime: text('observed_time').notNull(),
    shift: text('shift', { enum: ['frueh', 'spaet', 'nacht'] }).notNull(),
    body: text('body').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    check('care_reports_shift_check', sql`${t.shift} in ('frueh', 'spaet', 'nacht')`),
    check('care_reports_body_check', sql`length(${t.body}) between 1 and 10000`),
    check('care_reports_version_check', sql`${t.version} >= 1`),
    index('reports_patient_when').on(
      t.patientId,
      t.observedDate,
      t.observedTime,
      t.createdAt,
    ),
  ],
);

export const careReportRevisions = sqliteTable(
  'care_report_revisions',
  {
    id: text('id').primaryKey(),
    reportId: text('report_id')
      .notNull()
      .references(() => careReports.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    body: text('body').notNull(),
    actorType: text('actor_type', { enum: ['group', 'teacher'] }).notNull(),
    actorId: text('actor_id').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    unique('care_report_revisions_report_version_unique').on(t.reportId, t.version),
    check(
      'care_report_revisions_actor_type_check',
      sql`${t.actorType} in ('group', 'teacher')`,
    ),
  ],
);

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    actorType: text('actor_type', { enum: ['group', 'teacher'] }).notNull(),
    actorId: text('actor_id').notNull(),
    patientId: text('patient_id'),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    changes: text('changes').notNull(),
    occurredAt: text('occurred_at').notNull(),
  },
  (t) => [index('audit_patient_time').on(t.patientId, t.occurredAt)],
);

export type PatientRow = typeof patients.$inferSelect;
export type StudentGroupRow = typeof studentGroups.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type VitalDailyRecordRow = typeof vitalDailyRecords.$inferSelect;
export type MeasurementRequirementRow = typeof measurementRequirements.$inferSelect;
export type CareReportRow = typeof careReports.$inferSelect;
export type CareReportRevisionRow = typeof careReportRevisions.$inferSelect;
export type AuditLogRow = typeof auditLog.$inferSelect;
