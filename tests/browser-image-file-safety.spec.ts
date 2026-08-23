import { expect, test } from '@playwright/test';

test('shared image tools reject unsupported MIME before decoding', async ({ page }) => {
  await page.goto('/en/background-blur');
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'payload.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });
  await page.getByRole('button', { name: 'Run tool' }).click();
  await expect(page.getByRole('alert')).toContainText('unsupported input MIME type');
  await expect(page.getByText('No result yet.')).toBeVisible();
});

test('shared image tools reject oversized input before decoding', async ({ page }) => {
  await page.goto('/en/background-blur');
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'oversized.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(25 * 1024 * 1024 + 1),
  });
  await page.getByRole('button', { name: 'Run tool' }).click();
  await expect(page.getByRole('alert')).toContainText('file exceeds the maximum size');
});
