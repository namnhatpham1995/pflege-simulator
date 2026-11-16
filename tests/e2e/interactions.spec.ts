import { expect, test } from '@playwright/test';
import { loginAsGroup, openPatient, saveCell, vitalwerteUrl } from './helpers';

test.beforeEach(async ({ page }) => {
  await loginAsGroup(page);
});

test('chart hover drives the whole table column and its red cell', async ({ page }) => {
  const patientId = await openPatient(page);
  await page.goto(vitalwerteUrl(patientId, '2028-03-05'));

  await page.getByTestId('band-2028-03-06').hover();
  await expect(
    page.getByTestId('date-header-2028-03-06').getByRole('button'),
  ).toHaveAttribute('aria-current', 'date');

  const cell = page.getByTestId('cell-2028-03-06-diastolic');
  await expect(cell).toHaveClass(/bg-accent-soft/);
  await expect(cell).toHaveAttribute('data-missing', 'true');
  await expect(cell.getByRole('button')).toHaveText('Fehlt');

  await page.mouse.move(4, 4);
  await expect(
    page.getByTestId('date-header-2028-03-05').getByRole('button'),
  ).toHaveAttribute('aria-current', 'date');
});

test('the warning clears once every expected value is saved', async ({ page }) => {
  const patientId = await openPatient(page);
  await page.goto(vitalwerteUrl(patientId, '2028-03-07'));

  await expect(page.getByTestId('missing-warning')).toContainText('Fehlende Werte');
  await saveCell(page, '2028-03-07', 'systolic', '118');
  await saveCell(page, '2028-03-07', 'diastolic', '76');
  await saveCell(page, '2028-03-07', 'pulse', '68');

  await expect(page.getByTestId('missing-warning')).toContainText(
    'alle erwarteten Werte erfasst',
  );
});

test('the picker distinguishes 29 February 2028 from 2027', async ({ page }) => {
  const patientId = await openPatient(page);
  await page.goto(vitalwerteUrl(patientId, '2028-02-28'));

  await page.getByLabel('Tag', { exact: true }).fill('29');
  await page.getByLabel('Monat', { exact: true }).fill('2');
  await page.getByLabel('Jahr', { exact: true }).fill('2028');
  await page.getByLabel('Jahr', { exact: true }).press('Enter');
  await expect(page.getByTestId('selected-date')).toHaveText('Ausgewählt: 29.02.2028');

  await page.getByLabel('Jahr', { exact: true }).fill('2027');
  await page.getByLabel('Jahr', { exact: true }).press('Enter');
  await expect(page.getByText(/existiert nicht/)).toBeVisible();
  await expect(page.getByTestId('selected-date')).toHaveText('Ausgewählt: 29.02.2028');
});

test.describe('touch', () => {
  test.use({ hasTouch: true });

  test('tap selects a date and holding a cell opens one editor', async ({ page }) => {
    const patientId = await openPatient(page);
    await page.goto(vitalwerteUrl(patientId, '2028-03-08'));

    await page.getByTestId('band-2028-03-09').tap();
    await expect(page.getByTestId('selected-date')).toHaveText('Ausgewählt: 09.03.2028');

    const cell = page.getByTestId('cell-2028-03-09-pulse');
    await cell.scrollIntoViewIfNeeded();
    const box = await cell.boundingBox();
    if (!box) throw new Error('Zelle nicht sichtbar.');

    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
    });
    await page.waitForTimeout(700);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    await expect(cell.getByRole('textbox')).toBeVisible();
  });
});
