import { expect, test } from '@playwright/test';

test('qr-generator-reader: loads the complete workflow', async ({ page }) => {
  await page.goto('/en/qr-generator-reader');
  await expect(page.getByRole('heading', { level: 1, name: 'QR Code Generator & Reader' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Generate' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Read QR image' })).toBeVisible();
});

test('qr-generator-reader: generates PNG and SVG output from URL', async ({ page }) => {
  await page.goto('/en/qr-generator-reader');
  await page.getByLabel('Payload type').selectOption('url');
  await page.getByLabel('Content').fill('https://flixo.tools/tools');
  await page.getByRole('button', { name: 'Generate QR' }).click();
  await expect(page.getByAltText('Generated QR code')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download PNG' })).toHaveAttribute('download', 'flixo-qr.png');
  await expect(page.getByRole('link', { name: 'Download SVG' })).toHaveAttribute('download', 'flixo-qr.svg');
});

test('qr-generator-reader: builds Wi-Fi payload without leaking it to a network call', async ({ page }) => {
  await page.goto('/en/qr-generator-reader');
  await page.getByLabel('Payload type').selectOption('wifi');
  await page.getByLabel('Content').fill('Office WiFi|secret-password|WPA');
  await page.getByRole('button', { name: 'Generate QR' }).click();
  await expect(page.getByAltText('Generated QR code')).toBeVisible();
});

test('qr-generator-reader: rejects empty content', async ({ page }) => {
  await page.goto('/en/qr-generator-reader');
  await page.getByLabel('Content').fill('');
  await page.getByRole('button', { name: 'Generate QR' }).click();
  await expect(page.getByRole('alert')).toContainText('QR content is required');
});
