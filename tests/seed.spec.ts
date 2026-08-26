import { expect, test, type Download } from '@playwright/test';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVR4nGP8////fwYkwMTAwMAgqhnIIKoZiBBABozoWgBvpAkdy756fgAAAABJRU5ErkJggg==', 'base64');

type Canvas2DContext = CanvasRenderingContext2D | null;
type CanvasContextId = '2d' | 'webgl' | 'webgl2' | 'bitmaprenderer' | string;

async function hasWebGl(page: import('@playwright/test').Page) {
  return page.locator('canvas[aria-label="Seed preview"]').evaluate((element) => Boolean((element as HTMLCanvasElement).getContext('webgl')));
}

async function downloadBytes(download: Download) {
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Download stream is unavailable.');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function loadSeed(page: import('@playwright/test').Page, testInfo: import('@playwright/test').TestInfo) {
  await page.goto('/en/seed');
  await expect(page.getByRole('heading', { level: 1, name: 'Seed' })).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'seed-fixture.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('canvas[aria-label="Seed preview"]')).toBeVisible();
  const webgl = await hasWebGl(page);
  if (!webgl) testInfo.skip(true, 'Seed GPU assertions require WebGL, which is unavailable in this browser environment.');
  await page.waitForTimeout(150);
}

test('Seed: WebGL preview changes exported pixels and exports a non-empty PNG', async ({ page }, testInfo) => {
  await loadSeed(page, testInfo);

  const baselineExport = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const baselineDownload = await baselineExport;
  const baselineBytes = await downloadBytes(baselineDownload);
  expect(baselineDownload.suggestedFilename()).toBe('seed-edited.png');
  expect(baselineBytes.length).toBeGreaterThan(0);

  await page.getByRole('slider', { name: 'brightness' }).fill('50');
  await page.waitForTimeout(150);

  const adjustedExport = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const adjustedDownload = await adjustedExport;
  const adjustedBytes = await downloadBytes(adjustedDownload);
  expect(adjustedDownload.suggestedFilename()).toBe('seed-edited.png');
  expect(adjustedBytes.length).toBeGreaterThan(0);
  expect(adjustedBytes).not.toEqual(baselineBytes);
});

test('Seed: advanced pipeline controls alter non-destructive state and export', async ({ page }, testInfo) => {
  await loadSeed(page, testInfo);

  await expect(page.getByRole('slider', { name: 'Curves' })).toBeVisible();
  await page.getByRole('slider', { name: 'Curves' }).fill('35');
  await page.getByRole('slider', { name: 'Brush strength' }).fill('40');
  await page.getByRole('slider', { name: 'Perspective X' }).fill('10');
  await page.getByRole('slider', { name: 'Perspective Y' }).fill('-8');
  await page.getByRole('slider', { name: 'Lens Blur' }).fill('8');
  await page.getByRole('slider', { name: 'Bokeh' }).fill('20');
  await page.getByRole('spinbutton', { name: 'Healing X' }).fill('1');
  await page.getByRole('spinbutton', { name: 'Healing Y' }).fill('1');

  const exportPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const download = await exportPromise;
  expect(download.suggestedFilename()).toBe('seed-edited.png');
  expect((await downloadBytes(download)).length).toBeGreaterThan(0);
});

test('Seed: Undo and Redo restore and reapply the exported image state', async ({ page }, testInfo) => {
  await loadSeed(page, testInfo);

  const baselineExport = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const baselineDownload = await baselineExport;
  const baselineBytes = await downloadBytes(baselineDownload);

  await page.getByRole('slider', { name: 'brightness' }).fill('35');
  await page.waitForTimeout(150);
  const editedExport = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const editedDownload = await editedExport;
  const editedBytes = await downloadBytes(editedDownload);
  expect(editedBytes).not.toEqual(baselineBytes);

  await page.getByTestId('button-canvas-undo').click();
  await page.waitForTimeout(150);
  const undoExport = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const undoDownload = await undoExport;
  expect(await downloadBytes(undoDownload)).toEqual(baselineBytes);

  await page.getByTestId('button-canvas-redo').click();
  await page.waitForTimeout(150);
  const redoExport = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const redoDownload = await redoExport;
  expect(await downloadBytes(redoDownload)).toEqual(editedBytes);
});

test('Seed: accepts a second image for Double Exposure', async ({ page }, testInfo) => {
  await loadSeed(page, testInfo);
  await expect(page.locator('input[aria-label="Double Exposure file"]')).toBeVisible();
  await page.locator('input[aria-label="Double Exposure file"]').setInputFiles({ name: 'exposure.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('slider', { name: 'Exposure opacity' }).fill('60');
  const exportPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const download = await exportPromise;
  expect(download.suggestedFilename()).toBe('seed-edited.png');
});

test('Seed: shows a clear error when GPU rendering is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (contextId: CanvasContextId, ...args: unknown[]) {
      if (contextId === 'webgl') return null;
      return originalGetContext.call(this, contextId as never, ...args) as Canvas2DContext;
    };
  });

  await page.goto('/en/seed');
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'seed-fixture.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('alert')).toContainText('WebGL is not supported');
});

test.describe('SeedTool Real WebGL Engine & Overlay Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/seed');
    await expect(page.getByRole('heading', { level: 1, name: 'Seed' })).toBeVisible();
  });

  test('exposes the frozen canvas overlay contract on the real Seed route', async ({ page }) => {
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'seed-fixture.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByTestId('button-canvas-zoom-reset')).toHaveText('100%');
    await expect(page.getByTestId('button-canvas-compare')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('button-canvas-fullscreen')).toBeVisible();
  });

  test('applies 0.25x zoom steps and resets to 1x on the actual canvas stage', async ({ page }) => {
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'seed-fixture.png', mimeType: 'image/png', buffer: PNG });
    const zoomReset = page.getByTestId('button-canvas-zoom-reset');
    const zoomIn = page.getByTestId('button-canvas-zoom-in');
    const zoomOut = page.getByTestId('button-canvas-zoom-out');

    await zoomIn.click();
    await expect(zoomReset).toHaveText('125%');
    await expect(page.locator('[style*="transform: scale(1.25)"]')).toHaveCount(1);

    await zoomOut.click();
    await expect(zoomReset).toHaveText('100%');

    await zoomOut.click();
    await expect(zoomReset).toHaveText('75%');

    await zoomReset.click();
    await expect(zoomReset).toHaveText('100%');
  });

  test('binds compare lifecycle to the real Seed canvas', async ({ page }) => {
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'seed-fixture.png', mimeType: 'image/png', buffer: PNG });
    const compareBtn = page.getByTestId('button-canvas-compare');
    const canvas = page.locator('canvas[aria-label="Seed preview"]');
    await expect(canvas).toBeVisible();

    const box = await compareBtn.boundingBox();
    if (!box) throw new Error('Compare control has no bounding box.');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.up();
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('keeps compare lifecycle safe across keyboard activation and Escape cancellation', async ({ page }) => {
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'seed-fixture.png', mimeType: 'image/png', buffer: PNG });
    const compareBtn = page.getByTestId('button-canvas-compare');
    await compareBtn.focus();

    await page.keyboard.down('Space');
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.up('Space');
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'false');

    await page.keyboard.down('Enter');
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('cancels compare on window blur without changing the frozen API', async ({ page }) => {
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'seed-fixture.png', mimeType: 'image/png', buffer: PNG });
    const compareBtn = page.getByTestId('button-canvas-compare');
    const box = await compareBtn.boundingBox();
    if (!box) throw new Error('Compare control has no bounding box.');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'false');
    await page.mouse.up();
  });

  test('enters and exits fullscreen on the actual Seed stage when the browser exposes the API', async ({ page }) => {
    const fullscreenEnabled = await page.evaluate(() => Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen));
    test.skip(!fullscreenEnabled, 'Fullscreen API is unavailable in this browser environment.');

    const fullscreenBtn = page.getByTestId('button-canvas-fullscreen');
    await fullscreenBtn.click();
    await expect(page.locator('[data-testid="button-canvas-fullscreen"]')).toHaveAttribute('aria-label', 'Exit Fullscreen');
    await expect(page.locator('main > section')).toHaveJSProperty('tagName', 'SECTION');

    await fullscreenBtn.click();
    await expect(page.getByTestId('button-canvas-fullscreen')).toHaveAttribute('aria-label', 'Enter Fullscreen');
  });
});
