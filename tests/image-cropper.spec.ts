import { expect, test } from '@playwright/test';
import { assertToolOutputContract } from '../src/lib/contracts/tool-output';
import { imageCropperOutputContract } from '../src/tools/image-cropper/output-contract';
import { assertDownload, assertImageResult, uploadFixture } from './helpers/image-tool-fixture';

async function inspectPngOutput(page: Parameters<typeof test>[0]['page']) {
  return page.evaluate(async () => {
    const image = document.querySelector('img[alt="Tool result"]') as HTMLImageElement | null;
    if (!image) throw new Error('Tool result image not found.');
    const response = await fetch(image.src);
    if (!response.ok) throw new Error(`Output blob fetch failed: ${response.status}`);
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const signature = Array.from(bytes.slice(0, 8)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return {
      mimeType: blob.type,
      byteLength: blob.size,
      signature,
      width: image.naturalWidth,
      height: image.naturalHeight,
      bytes: Array.from(bytes),
    };
  });
}

test('image-cropper: creates a contract-valid PNG crop', async ({ page }) => {
  await page.goto('/en/image-cropper');
  await expect(page.getByRole('heading', { level: 1, name: 'Crop & Resize' })).toBeVisible();
  await uploadFixture(page);
  await page.getByRole('button', { name: 'Run tool' }).click();

  const result = await assertImageResult(page);
  expect(result.type).toBe('image/png');
  expect(result.width).toBeGreaterThan(0);
  expect(result.height).toBeGreaterThan(0);

  const output = await inspectPngOutput(page);
  const download = await assertDownload(page, /\.png$/);
  assertToolOutputContract(imageCropperOutputContract, {
    mimeType: output.mimeType,
    byteLength: output.byteLength,
    filename: download.suggestedFilename(),
    bytes: Uint8Array.from(output.bytes),
    dimensions: { width: output.width, height: output.height },
  });
  expect(output.signature).toBe('89504e470d0a1a0a');
  expect(output.width).toBe(result.width);
  expect(output.height).toBe(result.height);
});
