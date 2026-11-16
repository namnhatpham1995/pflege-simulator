import { expect, test } from '@playwright/test';
import { loginAsGroup, openPatient, saveCell, vitalwerteUrl } from './helpers';

test('the section tabs lead to Pflegebericht and back', async ({ page }) => {
  await loginAsGroup(page);
  await openPatient(page);

  await page.waitForLoadState('networkidle');
  await page.getByRole('link', { name: 'Pflegebericht' }).click();
  await expect(page).toHaveURL(/\/pflegebericht$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Pflegebericht' })).toBeVisible();

  await page.getByRole('link', { name: 'Vitalwerte' }).click();
  await expect(page).toHaveURL(/\/vitalwerte$/, { timeout: 15_000 });
  await expect(page.getByTestId('selected-date')).toBeVisible();
});

test('group login, save, reload and a stale edit answer 409', async ({ page }) => {
  await loginAsGroup(page);
  const patientId = await openPatient(page);

  await page.goto(vitalwerteUrl(patientId, '2028-02-29'));
  await expect(page.getByTestId('selected-date')).toHaveText('Ausgewählt: 29.02.2028');
  await expect(page.getByTestId('band-2028-02-29')).toBeVisible();

  await saveCell(page, '2028-02-29', 'systolic', '120');

  await page.reload();
  await expect(page.getByTestId('cell-2028-02-29-systolic').getByRole('button')).toHaveText('120');

  // A client that still holds version 0 must be refused, not overwrite the save.
  const status = await page.evaluate(
    async ({ id, date }) => {
      const response = await fetch(`/api/patients/${id}/vitals/${date}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version: 0, values: { systolic: 130 } }),
      });
      return response.status;
    },
    { id: patientId, date: '2028-02-29' },
  );
  expect(status).toBe(409);
});
