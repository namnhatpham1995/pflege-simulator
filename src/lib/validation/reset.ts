import { z } from 'zod';

export const RESET_CONFIRMATION = 'RESET';

export const resetRequestSchema = z.strictObject({
  confirm: z.literal(RESET_CONFIRMATION, {
    errorMap: () => ({ message: `Zum Zurücksetzen muss confirm "${RESET_CONFIRMATION}" lauten.` }),
  }),
});

export type ResetRequest = z.infer<typeof resetRequestSchema>;
