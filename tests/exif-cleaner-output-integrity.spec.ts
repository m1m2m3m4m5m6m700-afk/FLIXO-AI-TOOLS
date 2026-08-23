import { expect, test } from '@playwright/test';
import { assertToolOutputContract } from '../src/lib/contracts/tool-output';
import { exifCleanerOutputContract } from '../src/tools/exif-cleaner/output-contract';
import { assertDownload, assertImageResult, uploadFixture } from './helpers/image-tool-fixture';

test('exif-cleaner: produces a contract-valid PNG download', async ({ page }) => {
  await page.goto('/en/exif-cleaner');
  await expect(page.getByRole('heading', { level: 1, name: 'EXIF Cleaner' })).toBeVisible();
  await uploadFixture(page);
  await page.getByRole('button', { name: 'Run tool' }).click();

  const result = await assertImageResult(page);
  expect(result.type).toBe('image/png');
  expect(result.width).toBe(4);
  expect(result.height).toBe(4);

  assertToolOutputContract(exifCleanerOutputContract, {
    mimeType: result.type,
    byteLength: result.size,
  });
  await assertDownload(page, /flixo-exif-cleaner\.png$/);
});
