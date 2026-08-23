import { expect, test } from '@playwright/test';

test('watermark-remover: rejects corrupt image payload before producing a result', async ({ page }) => {
  await page.goto('/en/watermark-remover');
  await page.locator('#image-tool-file').setInputFiles({
    name: 'corrupt.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not a valid PNG payload'),
  });
  await page.getByRole('textbox', { name: 'X', exact: true }).fill('1');
  await page.getByRole('textbox', { name: 'Y', exact: true }).fill('1');
  await page.getByRole('textbox', { name: 'Width', exact: true }).fill('2');
  await page.getByRole('textbox', { name: 'Height', exact: true }).fill('2');
  await page.getByRole('button', { name: 'Run tool' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('No result yet.')).toBeVisible();
  await expect(page.locator('img[alt="Tool result"]')).toHaveCount(0);
});

test('watermark-remover: rejects empty file before decoding', async ({ page }) => {
  await page.goto('/en/watermark-remover');
  await page.locator('#image-tool-file').setInputFiles({
    name: 'empty.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(0),
  });
  await page.getByRole('textbox', { name: 'X', exact: true }).fill('1');
  await page.getByRole('textbox', { name: 'Y', exact: true }).fill('1');
  await page.getByRole('textbox', { name: 'Width', exact: true }).fill('2');
  await page.getByRole('textbox', { name: 'Height', exact: true }).fill('2');
  await page.getByRole('button', { name: 'Run tool' }).click();

  await expect(page.getByRole('alert')).toContainText('file size must be a positive integer');
  await expect(page.getByText('No result yet.')).toBeVisible();
});

test('watermark-remover: exposes an accessible primary workflow', async ({ page }) => {
  await page.goto('/en/watermark-remover');
  await expect(page.getByRole('heading', { level: 1, name: 'Watermark Remover' })).toBeVisible();
  await expect(page.locator('#image-tool-file')).toHaveAttribute('type', 'file');
  await expect(page.getByRole('textbox', { name: 'X', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Y', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Width', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Height', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run tool' })).toBeVisible();
});
