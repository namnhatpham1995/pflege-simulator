import { z } from 'zod';
import { isValidCalendarDate, isValidTime } from '@/lib/date';
import {
  MEASUREMENT_CATEGORIES,
  VITAL_FIELDS,
  categoryDefinition,
  type MeasurementCategory,
  type VitalField,
} from '@/lib/types';

export interface VitalFieldRule {
  field: VitalField;
  label: string;
  unit: string;
  kind: 'integer' | 'decimal';
  min: number;
  max: number;
}

/** The only place the plausible ranges live. Each boundary has a unit test. */
export const VITAL_RULES: Record<VitalField, VitalFieldRule> = {
  systolic: { field: 'systolic', label: 'Blutdruck systolisch', unit: 'mmHg', kind: 'integer', min: 50, max: 300 },
  diastolic: { field: 'diastolic', label: 'Blutdruck diastolisch', unit: 'mmHg', kind: 'integer', min: 30, max: 200 },
  pulse: { field: 'pulse', label: 'Puls', unit: 'Schläge/min', kind: 'integer', min: 20, max: 250 },
  temperature: { field: 'temperature', label: 'Temperatur', unit: '°C', kind: 'decimal', min: 30, max: 45 },
  weight: { field: 'weight', label: 'Gewicht', unit: 'kg', kind: 'decimal', min: 0.5, max: 400 },
  height: { field: 'height', label: 'Größe', unit: 'cm', kind: 'decimal', min: 30, max: 250 },
  pain: { field: 'pain', label: 'Schmerzen', unit: '0–10', kind: 'integer', min: 0, max: 10 },
  glucose: { field: 'glucose', label: 'Blutzucker', unit: 'mg/dL', kind: 'integer', min: 10, max: 900 },
};

export const VITAL_RULE_LIST: VitalFieldRule[] = VITAL_FIELDS.map((field) => VITAL_RULES[field]);

export const CATEGORY_KEYS = MEASUREMENT_CATEGORIES.map((category) => category.key) as [
  MeasurementCategory,
  ...MeasurementCategory[],
];

function numericField(field: VitalField) {
  const rule = VITAL_RULES[field];
  return z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      if (trimmed === '') return null;
      const normalized = trimmed.replace(',', '.');
      const parsed = Number(normalized);
      return Number.isNaN(parsed) ? trimmed : parsed;
    },
    z
      .number({
        invalid_type_error: 'Bitte eine Zahl eingeben.',
        required_error: 'Bitte eine Zahl eingeben.',
      })
      .min(rule.min, `Der Wert muss mindestens ${rule.min} ${rule.unit} betragen.`)
      .max(rule.max, `Der Wert darf höchstens ${rule.max} ${rule.unit} betragen.`)
      .refine((value) => (rule.kind === 'integer' ? Number.isInteger(value) : true), {
        message: 'Bitte eine ganze Zahl eingeben.',
      })
      .nullable(),
  );
}

/**
 * Unknown keys are rejected, which is how a `shift` in a measurement payload (or
 * any other accidental field) is refused instead of silently ignored.
 */
export const vitalsValuesSchema = z.strictObject({
  systolic: numericField('systolic').optional(),
  diastolic: numericField('diastolic').optional(),
  pulse: numericField('pulse').optional(),
  temperature: numericField('temperature').optional(),
  weight: numericField('weight').optional(),
  height: numericField('height').optional(),
  pain: numericField('pain').optional(),
  glucose: numericField('glucose').optional(),
});

export const entryCreateSchema = z.strictObject({
  category: z.enum(CATEGORY_KEYS, {
    errorMap: () => ({ message: 'Bitte eine gültige Messkategorie wählen.' }),
  }),
  values: vitalsValuesSchema,
  date: z
    .string()
    .refine(isValidCalendarDate, 'Bitte ein gültiges Datum im Format JJJJ-MM-TT angeben.'),
  time: z.string().refine(isValidTime, 'Bitte eine gültige Uhrzeit im Format HH:MM angeben.'),
});

export type EntryCreateInput = z.infer<typeof entryCreateSchema>;
export type VitalsValuesPatch = z.infer<typeof vitalsValuesSchema>;

/**
 * Category rules: exactly the category's fields, every one filled, nothing else.
 * The blood-pressure pair rule runs on the two values of this one save only.
 */
export function categoryValueErrors(
  category: MeasurementCategory,
  values: VitalsValuesPatch,
): Partial<Record<VitalField, string>> {
  const definition = categoryDefinition(category);
  const errors: Partial<Record<VitalField, string>> = {};

  for (const field of definition.fields) {
    if (values[field] === undefined || values[field] === null) {
      errors[field] = 'Bitte einen Wert eingeben.';
    }
  }
  for (const field of VITAL_FIELDS) {
    if (!definition.fields.includes(field) && values[field] !== undefined && values[field] !== null) {
      errors[field] = 'Dieser Wert gehört nicht zur gewählten Kategorie.';
    }
  }

  if (category === 'blutdruck') {
    const systolic = values.systolic;
    const diastolic = values.diastolic;
    if (typeof systolic === 'number' && typeof diastolic === 'number' && diastolic >= systolic) {
      errors.diastolic = 'Der diastolische Wert muss kleiner als der systolische Wert sein.';
    }
  }

  return errors;
}
