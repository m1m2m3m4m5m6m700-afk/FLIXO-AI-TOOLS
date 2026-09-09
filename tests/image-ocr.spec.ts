import { expect, test } from './fixtures/universal-runtime-evidence';
import { getAuthoritativeToolSeoName } from '../src/config/tool-seo-name-resolver';
import { getToolConfig } from '../src/config/tools';
import { uploadFixture } from './helpers/image-tool-fixture';

test('image-ocr: extracts text and downloads TXT', async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { Tesseract?: { recognize: () => Promise<{ data: { text: string } }> } }).Tesseract = {
      recognize: async () => ({ data: { text: 'FLIXO OCR OK' } }),
    };
  });
  await page.goto('/en/image-ocr');
  const tool = getToolConfig('image-ocr');
  const canonicalH1 = getAuthoritativeToolSeoName(tool, 'en');
  await expect(page.getByRole('heading', { level: 1, name: canonicalH1 })).toBeVisible();
  await uploadFixture(page);
  await page.getByRole('button', { name: 'Run tool' }).click();
  await expect(page.getByText('FLIXO OCR OK')).toBeVisible();
  const downloadControl = page.getByRole('button', { name: 'Download now' });
  await expect(downloadControl).toHaveAttribute('download', 'fixture.txt');
  await expect(downloadControl).toHaveAttribute('href', /^blob:/);
  const downloadPromise = page.waitForEvent('download');
  await downloadControl.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.txt$/);
});
