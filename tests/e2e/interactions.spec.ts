import { expect, test } from '@playwright/test';
import { dashboardUrl, openPatient, saveEntry, vitalwerteUrl } from './helpers';

test('the picker distinguishes 29 February 2028 from 2027', async ({ page }) => {
  const patientId = await openPatient(page, 4);
  await page.goto(vitalwerteUrl(patientId));

  await page.getByRole('textbox', { name: 'Tag', exact: true }).fill('29');
  await page.getByRole('textbox', { name: 'Monat', exact: true }).fill('2');
  await page.getByRole('textbox', { name: 'Jahr', exact: true }).fill('2027');
  await page.getByRole('textbox', { name: 'Jahr', exact: true }).press('Enter');
  await expect(page.getByText(/existiert nicht/)).toBeVisible();

  await page.getByRole('textbox', { name: 'Jahr', exact: true }).fill('2028');
  await page.getByRole('textbox', { name: 'Jahr', exact: true }).press('Enter');
  await expect(page.getByText(/existiert nicht/)).toHaveCount(0);
});

test('hovering a value box highlights its chart marker', async ({ page }) => {
  const patientId = await openPatient(page, 5);
  await page.goto(vitalwerteUrl(patientId));
  await saveEntry(page, 'Puls', { pulse: '88' }, '13:30');

  await page.goto(dashboardUrl(patientId));
  await page.getByRole('button', { name: /Puls 88 Schläge\/min/ }).hover();
  await expect(page.getByRole('tooltip')).toContainText('13:30');
  await expect(page.locator('circle[data-highlighted="true"]')).toHaveCount(1);

  await page.mouse.move(2, 2);
  await expect(page.locator('circle[data-highlighted="true"]')).toHaveCount(0);
});

test.describe('touch', () => {
  test.use({ hasTouch: true });

  test('tap shows the label and highlights, tap elsewhere dismisses', async ({ page }) => {
    const patientId = await openPatient(page, 6);
    await page.goto(vitalwerteUrl(patientId));
    await saveEntry(page, 'Puls', { pulse: '91' }, '15:45');

    await page.goto(dashboardUrl(patientId));
    const box = page.getByRole('button', { name: /Puls 91 Schläge\/min/ });
    await box.scrollIntoViewIfNeeded();
    await box.tap();
    await expect(page.getByRole('tooltip')).toContainText('15:45');
    await expect(page.locator('circle[data-highlighted="true"]')).toHaveCount(1);

    await page.getByRole('heading', { name: 'Dashboard' }).tap();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });
});
