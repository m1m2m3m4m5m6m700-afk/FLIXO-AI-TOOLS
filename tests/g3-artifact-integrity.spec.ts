import { expect, test, type Page } from '@playwright/test';
import { validateOutputIntegrity } from '../src/lib/contracts/output-integrity';

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

test('G3 real flow: upload → process → download → inspect image artifact', async ({ page }) => {
  await page.goto('/en/image-compressor');
  await expect(page.getByRole('heading', { name: 'Compress Images Online' })).toBeVisible();

  await page.locator('#image-file').setInputFiles({
    name: 'g3-source.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(SVG),
  });
  await page.getByRole('button', { name: 'Compress image' }).click();

  const download = page.getByRole('link', { name: 'Download image' });
  await expect(download).toHaveAttribute('download', 'flixo-compressed.webp', { timeout: 15000 });
  const filename = await download.getAttribute('download');
  const href = await download.getAttribute('href');
  expect(filename).toBe('flixo-compressed.webp');
  expect(href).toMatch(/^blob:/);

  const artifact = await readBlob(page, href!);
  const result = validateOutputIntegrity(
    artifact.size,
    artifact.mime,
    {
      toolId: 'image-compressor',
      allowedMime: ['image/webp'],
      allowedExtensions: ['webp'],
      maxBytes: 25 * 1024 * 1024,
      minBytes: 1,
      maxPixels: 40_000_000,
      signatures: [
        { hex: '52494646' },
      ],
      requireArtifact: true,
      requireSafeFilename: true,
    },
    { width: 1200, height: 800 },
    { filename: filename!, bytes: Uint8Array.from(artifact.bytes) },
  );

  expect(result.valid, result.failures.join('; ')).toBe(true);
  expect(result.bytes).toBeGreaterThan(0);
  expect(result.mime).toBe('image/webp');
});

test('G3 real flow: upload → process → download → inspect ZIP artifact', async ({ page }) => {
  await page.goto('/en/image-compressor');
  await page.locator('#image-file').setInputFiles([
    { name: 'g3-one.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SVG) },
    { name: 'g3-two.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SVG) },
  ]);
  await page.getByRole('button', { name: 'Compress all to ZIP' }).click();

  const download = page.getByRole('link', { name: 'Download ZIP' });
  await expect(download).toHaveAttribute('download', 'flixo-compressed-images.zip', { timeout: 15000 });
  const filename = await download.getAttribute('download');
  const href = await download.getAttribute('href');
  expect(filename).toBe('flixo-compressed-images.zip');
  expect(href).toMatch(/^blob:/);

  const artifact = await readBlob(page, href!);
  const result = validateOutputIntegrity(
    artifact.size,
    artifact.mime,
    {
      toolId: 'image-compressor-batch',
      allowedMime: ['application/zip'],
      allowedExtensions: ['zip'],
      maxBytes: 25 * 1024 * 1024,
      minBytes: 1,
      signatures: ['504b0304'],
      requireArtifact: true,
      requireSafeFilename: true,
    },
    undefined,
    { filename: filename!, bytes: Uint8Array.from(artifact.bytes) },
  );

  expect(result.valid, result.failures.join('; ')).toBe(true);
  expect(result.bytes).toBeGreaterThan(0);
  expect(result.mime).toBe('application/zip');
});
