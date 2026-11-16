import { expect, test } from '@playwright/test';
import { dashboardUrl, openPatient, saveEntry, vitalwerteUrl } from './helpers';

test('Start opens the patient list and the Dashboard is the landing section', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Start' })).toBeVisible();
  await page.getByRole('link', { name: 'Start' }).click();
  await expect(page).toHaveURL(/\/patients$/);
  await expect(page.getByRole('heading', { name: 'Fiktive Patienten' })).toBeVisible();

  const patientId = await openPatient(page, 0);
  await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('dashboard-label')).toBeVisible();
  await expect(page.getByTestId('vital-chart')).toBeVisible();
  expect(patientId).not.toBe('');
});

test('the section tabs lead to Vitalwerte and Pflegebericht and back', async ({ page }) => {
  const patientId = await openPatient(page, 1);

  await page.getByRole('link', { name: 'Vitalwerte' }).click();
  await expect(page).toHaveURL(/\/vitalwerte$/, { timeout: 15_000 });
  await expect(page.getByRole('tab', { name: 'Blutdruck' })).toBeVisible();

  await page.getByRole('link', { name: 'Pflegebericht' }).click();
  await expect(page).toHaveURL(/\/pflegebericht$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Pflegebericht' })).toBeVisible();

  await page.goto(dashboardUrl(patientId));
  await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
});

test('saves every category, shows them on the Dashboard and deletes one', async ({ page }) => {
  const patientId = await openPatient(page, 2);
  await page.goto(vitalwerteUrl(patientId));

  await saveEntry(page, 'Blutdruck', { systolic: '120', diastolic: '80' }, '08:00');
  await saveEntry(page, 'Puls', { pulse: '82' }, '09:15');
  await saveEntry(page, 'Temperatur', { temperature: '36,8' }, '09:20');
  await saveEntry(page, 'Gewicht', { weight: '74,5' }, '09:30');
  await saveEntry(page, 'Größe', { height: '178' }, '09:35');
  await saveEntry(page, 'Schmerzen', { pain: '0' }, '09:40');
  await saveEntry(page, 'Blutzucker', { glucose: '110' }, '09:45');

  await page.goto(dashboardUrl(patientId));
  await expect(page.getByTestId('entry-row-systolic').getByRole('button')).toHaveText('120/80');
  await expect(page.getByTestId('entry-row-pulse').getByRole('button')).toHaveText('82');
  await expect(page.getByTestId('entry-row-temperature').getByRole('button')).toHaveText('36,8');
  await expect(page.getByTestId('entry-row-weight').getByRole('button')).toHaveText('74,5');
  await expect(page.getByTestId('entry-row-pain').getByRole('button')).toHaveText('0');
  await expect(page.getByTestId('entry-row-glucose').getByRole('button')).toHaveText('110');

  const pulseBox = page.getByRole('button', { name: /Puls 82 Schläge\/min/ });
  await pulseBox.hover();
  await expect(page.getByRole('tooltip')).toContainText('09:15');
  await expect(page.locator('circle[data-highlighted="true"]')).toHaveCount(1);

  await page.getByRole('link', { name: 'Woche' }).click();
  await expect(page).toHaveURL(/view=week/);
  await expect(page.getByTestId('dashboard-label')).toContainText('–');
  await expect(page.getByTestId('entry-row-pulse').getByRole('button')).toHaveText('82');

  await page.goto(vitalwerteUrl(patientId));
  await page.getByRole('tab', { name: 'Puls', exact: true }).click();
  await page.getByRole('button', { name: /Eintrag vom .* 09:15 löschen/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByText(/Puls: 82 Schläge\/min/)).toHaveCount(0);

  await page.goto(dashboardUrl(patientId));
  await expect(page.getByTestId('entry-row-pulse')).toContainText('Keine Einträge');
});

test('two saves at the same minute both survive', async ({ page }) => {
  const patientId = await openPatient(page, 3);
  await page.goto(vitalwerteUrl(patientId));

  await saveEntry(page, 'Puls', { pulse: '70' }, '11:00');
  await saveEntry(page, 'Puls', { pulse: '75' }, '11:00');

  await page.getByRole('tab', { name: 'Puls', exact: true }).click();
  await expect(page.getByText(/Puls: 70 Schläge\/min/)).toBeVisible();
  await expect(page.getByText(/Puls: 75 Schläge\/min/)).toBeVisible();
});
