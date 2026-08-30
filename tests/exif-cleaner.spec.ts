import { expect, test } from '@playwright/test';
import { assertToolOutputContract } from '../src/lib/contracts/tool-output';
import { exifCleanerOutputContract } from '../src/tools/exif-cleaner/output-contract';
import { assertDownload, assertImageResult, uploadFixture } from './helpers/image-tool-fixture';

test('exif-cleaner: produces a contract-valid PNG without EXIF metadata', async ({ page }) => {
  await page.goto('/en/exif-cleaner');
  await expect(page.getByRole('heading', { level: 1, name: 'EXIF Cleaner' })).toBeVisible();
  await uploadFixture(page);
  await page.getByRole('button', { name: 'Run tool' }).click();

  const result = await assertImageResult(page);
  expect(result.type).toBe('image/png');

  const output = await page.evaluate(async () => {
    const image = document.querySelector('img[alt="Tool result"]') as HTMLImageElement | null;
    if (!image) throw new Error('Tool result image not found.');
    const response = await fetch(image.src);
    if (!response.ok) throw new Error(`Output blob fetch failed: ${response.status}`);
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const signature = Array.from(bytes.slice(0, 8)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const binary = new TextDecoder('latin1').decode(bytes);
    return {
      mimeType: blob.type,
      byteLength: blob.size,
      signature,
      width: image.naturalWidth,
      height: image.naturalHeight,
      hasExifChunk: binary.includes('eXIf'),
      bytes: Array.from(bytes),
    };
  });

  const download = await assertDownload(page, /\.png$/);
  assertToolOutputContract(exifCleanerOutputContract, {
    mimeType: output.mimeType,
    byteLength: output.byteLength,
    filename: download.suggestedFilename(),
    bytes: Uint8Array.from(output.bytes),
    dimensions: { width: output.width, height: output.height },
  });
  expect(output.signature).toBe('89504e470d0a1a0a');
  expect(output.width).toBe(result.width);
  expect(output.height).toBe(result.height);
  expect(output.hasExifChunk).toBe(false);
});
