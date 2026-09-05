import { expect, test } from '@playwright/test';
import { uploadFixture } from './helpers/image-tool-fixture';

test('image-ocr: extracts text and downloads TXT', async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { Tesseract?: { recognize: () => Promise<{ data: { text: string } }> } }).Tesseract = {
      recognize: async () => ({ data: { text: 'FLIXO OCR OK' } }),
    };
  });
  await page.goto('/en/image-ocr');
  await expect(page.getByRole('heading', { level: 1, name: 'Image to Text OCR' })).toBeVisible();
  await uploadFixture(page);
  await page.getByRole('button', { name: 'Run tool' }).click();
  await expect(page.getByText('FLIXO OCR OK')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download now' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.txt$/);
});
