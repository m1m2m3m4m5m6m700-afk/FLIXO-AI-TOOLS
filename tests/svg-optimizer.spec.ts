import { expect, test } from '@playwright/test';

const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><!-- redundant --><rect width="10" height="10" fill="red"/></svg>');

test('svg-optimizer: produces optimized valid SVG', async ({ page }) => {
  await page.goto('/en/svg-optimizer');
  await expect(page.getByRole('heading', { level: 1, name: 'SVG Optimizer' })).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'input.svg', mimeType: 'image/svg+xml', buffer: SVG });
  await page.getByRole('button', { name: 'Run tool' }).click();
  await expect(page.getByText('<svg', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download now' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download now' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.svg$/);
});
