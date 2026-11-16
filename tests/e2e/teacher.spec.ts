import { expect, test } from '@playwright/test';
import { createTeacherSession } from './teacher-session';

test('teacher edits patient details and stays read-only', async ({ page }) => {
  await page.goto('/');
  await page.context().addCookies([
    { name: 'pflege_session', value: await createTeacherSession(), url: page.url() },
  ]);

  await page.goto('/teacher');
  await page.getByRole('link', { name: 'Dashboard ansehen' }).first().click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByText('Geburtsdatum nicht angegeben')).toBeVisible();

  await page.getByRole('button', { name: 'Patientendaten bearbeiten' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Name/).fill('Herr Berger E2E');
  await dialog.getByRole('button', { name: 'Geburtsdatum festlegen' }).click();
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { name: 'Herr Berger E2E' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('Geburtsdatum: 01.01.1950')).toBeVisible();

  await page.goto('/patients');
  await expect(page.getByRole('link', { name: /Herr Berger E2E/ })).toBeVisible();
  await page.getByRole('link', { name: /Herr Berger E2E/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await expect(page.getByRole('button', { name: /Speichern|Löschen/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Vitalwerte' }).click();
  await expect(page.getByRole('tab', { name: 'Blutdruck' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Speichern' })).toHaveCount(0);
  await expect(page.getByText(/nur lesenden Zugriff/)).toBeVisible();

  await page.getByRole('link', { name: 'Pflegebericht' }).click();
  await expect(page.getByText(/nur lesenden Zugriff auf die Pflegeberichte/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bericht speichern' })).toHaveCount(0);
});
