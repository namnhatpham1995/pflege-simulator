import { expect, type Page } from '@playwright/test';

/** Start, open one patient's Dashboard by roster position and return the patient id. */
export async function openPatient(page: Page, index = 0): Promise<string> {
  await page.goto('/patients');
  const link = page.locator('main li a').nth(index);
  await expect(link).toBeVisible();
  await page.waitForLoadState('networkidle');
  await link.click();
  await expect(page).toHaveURL(/\/patients\/[^/]+\/dashboard/, { timeout: 15_000 });
  const patientId = new URL(page.url()).pathname.split('/')[2];
  if (!patientId) throw new Error('Patienten-ID fehlt in der URL.');
  return patientId;
}

export function vitalwerteUrl(patientId: string): string {
  return `/patients/${patientId}/vitalwerte`;
}

export function dashboardUrl(patientId: string, view: 'day' | 'week' = 'day'): string {
  return `/patients/${patientId}/dashboard?view=${view}`;
}

/** Fill one category form and press Speichern, waiting for the server confirmation. */
export async function saveEntry(
  page: Page,
  category: string,
  values: Record<string, string>,
  time?: string,
): Promise<void> {
  await page.getByRole('tab', { name: category, exact: true }).click();
  for (const [field, value] of Object.entries(values)) {
    await page.locator(`#entry-${field}`).fill(value);
  }
  if (time) await page.locator('#entry-time').fill(time);
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByText('Gespeichert.')).toBeVisible({ timeout: 20_000 });
}
