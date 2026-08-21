import { expect, test, type Page } from '@playwright/test';

const onlineApiUrl = 'https://loco.os.mieweb.org';
const onlineApiKey = '202337e52dff4fb69e97857d';

async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Settings' }).click();
}

test('uses offline translations by default', async ({ page }) => {
  const onlineRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith(onlineApiUrl)) onlineRequests.push(request.url());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'eSheet Playground' })).toBeVisible();
  await openSettings(page);

  await expect(page.getByRole('combobox', { name: 'Translation mode' })).toContainText('Offline');
  await expect(page.getByRole('combobox', { name: 'Language' })).toContainText('Original');
  await page.getByRole('combobox', { name: 'Language' }).click();
  await expect(page.getByRole('option', { name: 'Spanish' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Chinese (Simplified)' })).toBeVisible();
  expect(onlineRequests).toEqual([]);

  await page.getByRole('option', { name: 'Spanish' }).click();
  await expect(page.getByText('Explorar')).toHaveCount(3);
});

test('switches to online mode and loads languages from Loco', async ({ page }) => {
  const onlineRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith(onlineApiUrl)) onlineRequests.push(request.url());
  });

  await page.goto('/');
  await openSettings(page);
  await page.getByRole('combobox', { name: 'Translation mode' }).click();
  await page.getByRole('option', { name: 'Online (Loco API)' }).click();
  await page.waitForFunction(() => localStorage.getItem('esheet-loco-mode') === 'online');
  await page.reload();
  await page.waitForLoadState('networkidle');
  await openSettings(page);

  await expect(page.getByRole('combobox', { name: 'Translation mode' })).toContainText('Online');
  await expect(page.getByText(`API URL: ${onlineApiUrl}`)).toBeVisible();
  await expect(page.getByText(`API key: ${onlineApiKey}`)).toBeVisible();
  await page.getByRole('combobox', { name: 'Language' }).click();
  await expect(page.getByRole('option', { name: 'Spanish' })).toBeVisible();
  expect(onlineRequests.some((url) => url.includes('/api/'))).toBe(true);
});
