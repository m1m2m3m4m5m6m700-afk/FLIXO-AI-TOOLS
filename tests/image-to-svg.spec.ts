import { expect, test } from '@playwright/test';
import { assertToolOutputContract } from '../src/lib/contracts/tool-output';
import { imageToSvgOutputContract } from '../src/tools/image-to-svg/output-contract';
import { uploadFixture } from './helpers/image-tool-fixture';

test('image-to-svg: creates a contract-valid SVG output and download', async ({ page }) => {
  await page.goto('/en/image-to-svg');
  await expect(page.getByRole('heading', { level: 1, name: 'Image to SVG' })).toBeVisible();
  await uploadFixture(page);
  await page.getByRole('button', { name: 'Run tool' }).click();

  const renderedSvg = await page.getByText('<svg', { exact: false }).textContent();
  expect(renderedSvg).toContain('<svg');
  expect(renderedSvg).toContain('xmlns="http://www.w3.org/2000/svg"');

  await expect(page.getByRole('button', { name: 'Download now' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download now' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.svg$/);
  expect(download.suggestedFilename()).not.toContain('undefined');

  const stream = await download.createReadStream();
  if (!stream) throw new Error('SVG download stream unavailable.');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks);
  const text = bytes.toString('utf8').trim();

  assertToolOutputContract(imageToSvgOutputContract, {
    mimeType: 'image/svg+xml',
    byteLength: bytes.byteLength,
    filename: download.suggestedFilename(),
    bytes: new Uint8Array(bytes),
  });

  expect(bytes.byteLength).toBeGreaterThan(100);
  expect(text.startsWith('<svg') || text.startsWith('<?xml')).toBe(true);
  const match = text.match(/<svg\b[^>]*>/i);
  expect(match).not.toBeNull();
  expect(match?.[0]).toContain('xmlns="http://www.w3.org/2000/svg"');
});
