import { expect, test } from '@playwright/test';
import { loginAsGroup, openPatient, vitalwerteUrl } from './helpers';

test('the workspace is labelled, focusable and does not rely on colour alone', async ({ page }) => {
  await loginAsGroup(page);
  const patientId = await openPatient(page);
  await page.goto(vitalwerteUrl(patientId, '2028-03-10'));

  await expect(page.getByRole('group', { name: 'Ausgewähltes Datum' })).toBeVisible();
  await expect(page.getByLabel('Tag', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Monat', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Jahr', { exact: true })).toBeVisible();

  await expect(page.getByTestId('missing-warning')).toHaveAttribute('aria-live', 'polite');

  // Non-colour indicator: the cell carries the word "Fehlt" plus an accessible name.
  const missingCell = page.getByTestId('cell-2028-03-10-systolic');
  await expect(missingCell.getByRole('button')).toHaveText('Fehlt');
  await expect(missingCell.getByRole('button')).toHaveAccessibleName(/fehlt/);

  await expect(page.locator('table caption')).toHaveClass(/sr-only/);

  // Every interactive control exposes a name; no icon-only button is unnamed.
  const unnamed = await page.evaluate(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea'),
    );
    return elements
      .filter((element) => {
        const aria = element.getAttribute('aria-label')?.trim();
        const labelledBy = element.getAttribute('aria-labelledby');
        const text = element.textContent?.trim();
        const id = element.id;
        const label = id ? document.querySelector(`label[for="${id}"]`)?.textContent?.trim() : '';
        return !aria && !labelledBy && !text && !label;
      })
      .map((element) => element.outerHTML.slice(0, 120));
  });
  expect(unnamed).toEqual([]);

  // Keyboard order starts at the day input and moves through month, year and calendar.
  await page.getByLabel('Tag', { exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Monat', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Jahr', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Kalender öffnen' })).toBeFocused();
});
