import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

interface CodeEntry {
  groupName: string;
  groupId: string;
  code: string;
}

export function readCodes(): CodeEntry[] {
  return JSON.parse(readFileSync('.local/e2e-codes.json', 'utf8')) as CodeEntry[];
}

export async function loginAsGroup(page: Page, index = 0): Promise<CodeEntry> {
  const entry = readCodes()[index];
  if (!entry) throw new Error('Keine E2E-Zugangscodes gefunden. Zuerst npm run e2e:seed ausführen.');

  await page.goto('/login');
  await page.getByLabel(/Zugangscode der Gruppe/).fill(entry.code);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/patients$/);
  return entry;
}

/** Opens the first patient's Vitalwerte page and returns the patient id. */
export async function openPatient(page: Page): Promise<string> {
  const link = page.getByRole('link', { name: /Frau Albrecht/ });
  await expect(link).toBeVisible();
  // The login redirect and the app shell hydrate in separate ticks; clicking
  // during that hand-over can be swallowed by the pending client navigation.
  await page.waitForLoadState('networkidle');
  await link.click();
  await expect(page).toHaveURL(/\/patients\/[^/]+\/vitalwerte/, { timeout: 15_000 });
  const patientId = new URL(page.url()).pathname.split('/')[2];
  if (!patientId) throw new Error('Patienten-ID fehlt in der URL.');
  return patientId;
}

export function vitalwerteUrl(patientId: string, date?: string): string {
  return `/patients/${patientId}/vitalwerte${date ? `?date=${date}` : ''}`;
}

export async function saveCell(page: Page, date: string, field: string, value: string): Promise<void> {
  const cell = page.getByTestId(`cell-${date}-${field}`);
  await cell.getByRole('button').click();
  const input = cell.getByRole('textbox');
  await input.fill(value);
  await input.press('Enter');
  await expect(cell.getByRole('button')).toHaveText(value);
}
