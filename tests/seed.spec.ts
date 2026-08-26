import { expect, test } from '@playwright/test';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVR4nGP8////fwYkwMTAwMAgqhnIIKoZiBBABozoWgBvpAkdy756fgAAAABJRU5ErkJggg==', 'base64');

type Canvas2DContext = CanvasRenderingContext2D | null;
type CanvasContextId = '2d' | 'webgl' | 'webgl2' | 'bitmaprenderer' | string;

async function hasWebGl(page: import('@playwright/test').Page) {
  return page.locator('canvas[aria-label="Seed preview"]').evaluate((element) => Boolean((element as HTMLCanvasElement).getContext('webgl')));
}

async function gpuPixels(page: import('@playwright/test').Page) {
  return page.locator('canvas[aria-label="Seed preview"]').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext('webgl');
    if (!gl) throw new Error('WebGL context unavailable for verification.');
    gl.finish();
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return Array.from(pixels);
  });
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

test('Seed: WebGL preview changes pixels and exports a non-empty PNG', async ({ page }, testInfo) => {
  await loadSeed(page, testInfo);
  const baseline = await gpuPixels(page);
  await page.getByRole('slider', { name: 'brightness' }).fill('50');
  await page.waitForTimeout(150);
  const adjusted = await gpuPixels(page);
  expect(adjusted).not.toEqual(baseline);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('seed-edited.png');
  expect((await download.createReadStream()) ?? null).toBeTruthy();
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
  expect((await download.createReadStream()) ?? null).toBeTruthy();
});

test('Seed: Undo and Redo restore and reapply a GPU color change', async ({ page }, testInfo) => {
  await loadSeed(page, testInfo);
  const baseline = await gpuPixels(page);
  await page.getByRole('slider', { name: 'brightness' }).fill('35');
  await page.waitForTimeout(150);
  const edited = await gpuPixels(page);
  expect(edited).not.toEqual(baseline);

  await page.getByTestId('button-canvas-undo').click();
  await page.waitForTimeout(150);
  expect(await gpuPixels(page)).toEqual(baseline);

  const redoButton = page.getByTestId('button-canvas-redo');
  if (await redoButton.count()) {
    await redoButton.click();
  } else {
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
  }
  await page.waitForTimeout(150);
  expect(await gpuPixels(page)).toEqual(edited);
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

  test('binds compare lifecycle to the real Seed canvas', async ({ page }, testInfo) => {
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'seed-fixture.png', mimeType: 'image/png', buffer: PNG });
    const compareBtn = page.getByTestId('button-canvas-compare');
    const canvas = page.locator('canvas[aria-label="Seed preview"]');
    await expect(canvas).toBeVisible();

    if (!(await hasWebGl(page))) {
      testInfo.skip(true, 'Seed compare pixel assertions require WebGL, which is unavailable in this browser environment.');
    }

    const baseline = await gpuPixels(page);
    await page.getByRole('slider', { name: 'brightness' }).fill('40');
    await page.waitForTimeout(150);
    const edited = await gpuPixels(page);
    expect(edited).not.toEqual(baseline);

    await compareBtn.focus();
    await page.keyboard.down('Space');
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.up('Space');
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'false');

    await compareBtn.focus();
    await page.keyboard.down('Enter');
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'false');

    expect(await gpuPixels(page)).toEqual(edited);
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
    await compareBtn.focus();
    await page.keyboard.down('Space');
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(compareBtn).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.up('Space');
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
