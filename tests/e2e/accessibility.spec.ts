import { expect, test } from '@playwright/test';
import { dashboardUrl, openPatient, vitalwerteUrl } from './helpers';

test('the workspace is labelled, keyboard reachable and free of missing-value signalling', async ({
  page,
}) => {
  const patientId = await openPatient(page, 7);

  await expect(page.getByRole('navigation', { name: 'Bereiche' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('Fehlt')).toHaveCount(0);
  // The Dashboard has date navigation but no data-entry, save or delete control.
  await expect(page.locator('#entry-pulse')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Speichern|Löschen/ })).toHaveCount(0);

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

  await page.goto(vitalwerteUrl(patientId));
  await expect(page.getByRole('tablist', { name: 'Messkategorien' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(7);
  await expect(page.getByRole('group', { name: 'Tag' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Tag', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Monat', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Jahr', exact: true })).toBeVisible();
  await expect(page.getByLabel(/Uhrzeit/)).toBeVisible();

  await page.getByRole('textbox', { name: 'Tag', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Monat', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Jahr', exact: true })).toBeFocused();

  await page.goto(dashboardUrl(patientId, 'week'));
  await expect(page.getByTestId('dashboard-label')).toContainText('–');
  await expect(page.getByText('Fehlt')).toHaveCount(0);
});
