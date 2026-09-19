import { expect, test } from './fixtures/universal-runtime-evidence';
import { PNG } from './helpers/image-tool-fixture';

test.describe('shared image workbench integration', () => {
  for (const [path, inputId, runLabel, downloadName] of [
    ['/en/image-compressor', '#image-file', 'Compress image', 'Download image'],
    ['/en/image-converter', '#image-tool-file', 'Run tool', 'Download now'],
    ['/en/image-cropper', '#image-tool-file', 'Run tool', 'Download now'],
  ] as const) {
    test(`${path} uses the shared input/preview/output/export contract`, async ({ page }) => {
      await page.goto(path);
      const expectedToolId = path.endsWith('image-cropper') ? 'image-cropper' : path.endsWith('image-converter') ? 'image-converter' : 'image-compressor';
      await expect(page.locator('.image-tool-shell')).toHaveAttribute('data-tool-id', expectedToolId);
      await page.locator(inputId).setInputFiles({ name: path.endsWith('image-compressor') ? 'compressor-fixture.png' : 'fixture.png', mimeType: 'image/png', buffer: PNG });
      await expect(page.getByText('Before')).toHaveCount(1);
      await page.getByRole('button', { name: runLabel }).click();
      if (downloadName === 'Download image') {
        await expect(page.getByRole('link', { name: downloadName })).toBeVisible();
      } else {
        await expect(page.getByRole('button', { name: downloadName })).toBeVisible();
      }
      await expect(page.locator('img[alt="Tool result"]')).toBeVisible();
      await expect(page.getByText('After')).toHaveCount(1);
    });
  }
});
