import { expect, test } from '@playwright/test';
import { assertToolOutputContract } from '../src/lib/contracts/tool-output';
import { watermarkAdderOutputContract } from '../src/tools/watermark-adder/output-contract';
import { assertDownload, assertImageResult, uploadFixture } from './helpers/image-tool-fixture';

test('watermark-adder: renders a contract-valid downloadable image', async ({ page }) => {
  await page.goto('/en/watermark-adder');
  await expect(page.getByRole('heading', { level: 1, name: 'Watermark Adder' })).toBeVisible();
  await uploadFixture(page);
  await page.getByRole('button', { name: 'Run tool' }).click();
  const result = await assertImageResult(page);
  const download = await assertDownload(page, /\.(png|jpg|webp)$/);
  assertToolOutputContract(watermarkAdderOutputContract, {
    mimeType: result.type,
    byteLength: result.size,
    filename: download.suggestedFilename(),
    bytes: Uint8Array.from(result.bytes),
    dimensions: { width: result.width, height: result.height },
  });
  expect(result.width).toBeGreaterThan(0);
  expect(result.height).toBeGreaterThan(0);
});
