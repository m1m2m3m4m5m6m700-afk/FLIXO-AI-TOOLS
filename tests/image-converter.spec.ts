import { expect, test } from '@playwright/test';
import { assertToolOutputContract } from '../src/lib/contracts/tool-output';
import { imageConverterOutputContract } from '../src/tools/image-converter/output-contract';
import { assertDownload, assertImageResult, uploadFixture } from './helpers/image-tool-fixture';

async function assertWebpSignature(page: Parameters<typeof test>[0]['page']) {
  return page.evaluate(async () => {
    const image = document.querySelector('img[alt="Tool result"]') as HTMLImageElement | null;
    if (!image) throw new Error('Tool result image not found.');
    const response = await fetch(image.src);
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    const signature = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return { mimeType: blob.type, byteLength: blob.size, signature };
  });
}

test('image-converter: converts to WebP with a contract-valid output', async ({ page }) => {
  await page.goto('/en/image-converter');
  await expect(page.getByRole('heading', { level: 1, name: 'Image Converter' })).toBeVisible();
  await uploadFixture(page);
  await page.getByLabel('Output format').selectOption('image/webp');
  await page.getByRole('button', { name: 'Run tool' }).click();

  const result = await assertImageResult(page);
  expect(result.type).toBe('image/webp');
  expect(result.width).toBe(4);
  expect(result.height).toBe(4);

  const output = await assertWebpSignature(page);
  assertToolOutputContract(imageConverterOutputContract, output);
  expect(output.signature.startsWith('52494646')).toBe(true);

  await assertDownload(page, /\.webp$/);
});

test('image-converter: rejects unsupported MIME before decoding', async ({ page }) => {
  await page.goto('/en/image-converter');
  await page.locator('#image-tool-file').setInputFiles({
    name: 'payload.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });
  await page.getByRole('button', { name: 'Run tool' }).click();
  await expect(page.getByRole('alert')).toContainText('unsupported input MIME type');
  await expect(page.getByText('No result yet.')).toBeVisible();
});

test('image-converter: rejects empty files before decoding', async ({ page }) => {
  await page.goto('/en/image-converter');
  await page.locator('#image-tool-file').setInputFiles({
    name: 'empty.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(0),
  });
  await page.getByRole('button', { name: 'Run tool' }).click();
  await expect(page.getByRole('alert')).toContainText('file size must be a positive integer');
});

test('image-converter: rejects oversized files before decoding', async ({ page }) => {
  await page.goto('/en/image-converter');
  const oversized = Buffer.alloc(25 * 1024 * 1024 + 1);
  await page.locator('#image-tool-file').setInputFiles({
    name: 'oversized.png',
    mimeType: 'image/png',
    buffer: oversized,
  });
  await page.getByRole('button', { name: 'Run tool' }).click();
  await expect(page.getByRole('alert')).toContainText('file exceeds the maximum size');
});
