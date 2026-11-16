import { z } from 'zod';
import { isValidCalendarDate, isValidTime } from '@/lib/date';

export const MAX_REPORT_BODY = 10_000;

export const reportBodySchema = z
  .string()
  .trim()
  .min(1, 'Bitte einen Bericht eingeben.')
  .max(MAX_REPORT_BODY, `Der Bericht darf höchstens ${MAX_REPORT_BODY} Zeichen lang sein.`);

export const careReportCreateSchema = z.strictObject({
  observedDate: z
    .string()
    .refine(isValidCalendarDate, 'Bitte ein gültiges Datum im Format JJJJ-MM-TT angeben.'),
  observedTime: z.string().refine(isValidTime, 'Bitte eine gültige Uhrzeit im Format HH:MM angeben.'),
  shift: z.enum(['frueh', 'spaet', 'nacht']),
  body: reportBodySchema,
});

export const careReportUpdateSchema = z.strictObject({
  version: z.number({ required_error: 'version fehlt.' }).int().min(1),
  body: reportBodySchema,
});

export type CareReportCreateInput = z.infer<typeof careReportCreateSchema>;
export type CareReportUpdateInput = z.infer<typeof careReportUpdateSchema>;
