import { expect, test } from '@playwright/test';
import { assertToolOutputContract } from '../src/lib/contracts/tool-output';
import { watermarkRemoverOutputContract } from '../src/tools/watermark-remover/output-contract';
import { assertDownload, assertImageResult, uploadFixture } from './helpers/image-tool-fixture';

test('watermark-remover: produces a valid cleaned PNG', async ({ page }) => {
  await page.goto('/en/watermark-remover');
  await expect(page.getByRole('heading', { level: 1, name: 'Watermark Remover' })).toBeVisible();
  await uploadFixture(page);
  for (const [name, value] of [['X', '1'], ['Y', '1'], ['Width', '2'], ['Height', '2']] as const) {
    await page.getByRole('textbox', { name, exact: true }).fill(value);
  }
  await page.getByRole('button', { name: 'Run tool' }).click();
  const result = await assertImageResult(page);
  const download = await assertDownload(page, /\.png$/);
  assertToolOutputContract(watermarkRemoverOutputContract, {
    mimeType: result.type,
    byteLength: result.size,
    filename: download.suggestedFilename(),
    bytes: Uint8Array.from(result.bytes),
    dimensions: { width: result.width, height: result.height },
  });
  expect(result.type).toBe('image/png');
  expect(result.width).toBeGreaterThan(0);
  expect(result.height).toBeGreaterThan(0);
});
