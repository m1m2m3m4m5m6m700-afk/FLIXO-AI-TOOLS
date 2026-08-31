import { expect, test, type Locator, type Page } from '@playwright/test';
import { validateOutputIntegrity } from '../src/lib/contracts/output-integrity';
import { getToolOutputContract } from '../src/lib/contracts/tool-output-contracts';
import { getLocalizedToolTitle } from '../src/lib/seo/tool-seo';
import { uploadFixture } from './helpers/upload-file';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#223344"/><circle cx="300" cy="220" r="180" fill="#67e8f9"/><circle cx="850" cy="560" r="260" fill="#164e63"/></svg>`;
type BrowserArtifact = { mime: string; bytes: number[]; size: number };

async function readBlob(page: Page, href: string): Promise<BrowserArtifact> {
  return page.evaluate(async (objectUrl: string) => {
    const response = await fetch(objectUrl);
    if (!response.ok) throw new Error(`download fetch failed with HTTP ${response.status}`);
    const blob = await response.blob();
    const content = new Uint8Array(await blob.arrayBuffer());
    return { mime: blob.type, bytes: Array.from(content), size: blob.size };
  }, href);
}

async function readDownload(page: Page, link: Locator, expectedFilename: string): Promise<{ filename: string; bytes: number[] }> {
  const downloadPromise = page.waitForEvent('download');
  await link.click();
  const download = await downloadPromise;
  const filename = download.suggestedFilename();
  expect(filename).toBe(expectedFilename);
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return { filename, bytes: Array.from(Buffer.concat(chunks)) };
}

async function waitForImageCompressorReady(page: Page) {
  await page.goto('/en/image-compressor', { waitUntil: 'domcontentloaded' });
  const heading = page.getByRole('heading', { name: getLocalizedToolTitle('en', 'image-compressor', 'Image Compressor'), exact: true });
  await expect(heading).toBeVisible();
  const input = page.locator('#image-file');
  await expect(input).toHaveCount(1);
  await expect(input).toBeAttached();
  await expect(input).toBeEnabled();
}

test('G3-54..85 image flow: upload → process → download → validate', async ({ page }) => {
  await waitForImageCompressorReady(page);
  await uploadFixture(page, { name: 'g3-source.svg', mimeType: 'image/svg+xml', content: SVG });
  await page.getByRole('button', { name: 'Compress image', exact: true }).click();

  const downloadLink = page.getByRole('link', { name: 'Download image', exact: true });
  await expect(downloadLink).toHaveAttribute('download', 'flixo-compressed.webp', { timeout: 15000 });
  const filename = await downloadLink.getAttribute('download');
  const href = await downloadLink.getAttribute('href');
  expect(filename).toBe('flixo-compressed.webp');
  expect(href).toMatch(/^blob:/);
  const artifact = await readBlob(page, href!);
  const saved = await readDownload(page, downloadLink, 'flixo-compressed.webp');
  expect(saved.bytes).toEqual(artifact.bytes);

  const contract = getToolOutputContract('image-compressor');
  expect(contract).toBeDefined();
  const result = validateOutputIntegrity(
    artifact.size, artifact.mime,
    { toolId: 'image-compressor', allowedMime: ['image/webp'], allowedExtensions: ['webp'], maxBytes: 25 * 1024 * 1024, minBytes: 1, maxPixels: 40_000_000, signatures: [{ hex: '52494646' }], requireArtifact: true, requireSafeFilename: true },
    { width: 1200, height: 800 },
    { filename: filename!, bytes: Uint8Array.from(saved.bytes) },
  );
  expect(result.valid, result.failures.join('; ')).toBe(true);
  expect(result.bytes).toBeGreaterThan(0);
  expect(result.mime).toBe('image/webp');
});

test('G3-54..85 batch flow: upload → process → download → validate ZIP', async ({ page }) => {
  await waitForImageCompressorReady(page);
  await uploadFixture(page, [
    { name: 'g3-one.svg', mimeType: 'image/svg+xml', content: SVG },
    { name: 'g3-two.svg', mimeType: 'image/svg+xml', content: SVG },
  ]);
  await page.getByRole('button', { name: 'Compress all to ZIP', exact: true }).click();

  const downloadLink = page.getByRole('link', { name: 'Download ZIP', exact: true });
  await expect(downloadLink).toHaveAttribute('download', 'flixo-compressed-images.zip', { timeout: 15000 });
  const filename = await downloadLink.getAttribute('download');
  const href = await downloadLink.getAttribute('href');
  expect(filename).toBe('flixo-compressed-images.zip');
  expect(href).toMatch(/^blob:/);
  const artifact = await readBlob(page, href!);
  const saved = await readDownload(page, downloadLink, 'flixo-compressed-images.zip');
  expect(saved.bytes).toEqual(artifact.bytes);

  const contract = getToolOutputContract('image-compressor');
  expect(contract).toBeDefined();
  const zipVariant = contract!.variants.find((variant) => variant.outputMimeTypes.includes('application/zip'));
  expect(zipVariant).toBeDefined();
  const result = validateOutputIntegrity(
    artifact.size, artifact.mime,
    {
      toolId: 'image-compressor',
      allowedMime: ['application/zip'],
      allowedExtensions: ['zip'],
      maxBytes: zipVariant!.maxOutputBytes,
      minBytes: zipVariant!.minOutputBytes,
      signatures: [{ hex: '504b0304' }],
      requireArtifact: true,
      requireSafeFilename: true,
    },
    undefined,
    { filename: filename!, bytes: Uint8Array.from(saved.bytes) },
  );
  expect(result.valid, result.failures.join('; ')).toBe(true);
  expect(result.bytes).toBeGreaterThan(0);
  expect(result.mime).toBe('application/zip');
});
