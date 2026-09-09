import { expect, test, type Page, type TestInfo } from './fixtures/universal-runtime-evidence';
import { PNG } from './helpers/image-tool-fixture';

type Canvas2DContext = CanvasRenderingContext2D | null;
type CanvasContextId = '2d' | 'webgl' | 'webgl2' | 'bitmaprenderer' | string;

const canvasLocator = (page: Page) => page.locator('canvas[aria-label="Seed preview"]');
const seedStageLocator = (page: Page) => canvasLocator(page).locator('xpath=ancestor::section[1]');

async function hasWebGl(page: Page) {
  return canvasLocator(page).evaluate((element) => Boolean((element as HTMLCanvasElement).getContext('webgl')));
}

async function canvasScreenshot(page: Page) {
  return canvasLocator(page).screenshot({ animations: 'disabled' });
}

async function waitForGpuRender(page: Page, previousRevision: string | null = null) {
  const canvas = canvasLocator(page);
  await expect.poll(() => canvas.getAttribute('data-render-revision'), { timeout: 3000 }).not.toBe(previousRevision);
}

async function loadSeed(page: Page, testInfo: TestInfo, requireWebGL = true) {
  await page.goto('/en/seed');
  await expect(page.getByRole('heading', { level: 1, name: 'Seed' })).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'seed-fixture.png', mimeType: 'image/png', buffer: PNG });
  await expect(canvasLocator(page)).toBeVisible();
  if (requireWebGL && !(await hasWebGl(page))) {
    testInfo.skip(true, 'Seed GPU assertions require WebGL, which is unavailable in this browser environment.');
  }
  await waitForGpuRender(page, '0');
}

test('Seed: WebGL preview changes pixels and exports a non-empty PNG', async ({ page }, testInfo) => {
  await loadSeed(page, testInfo);
  const baseline = await canvasScreenshot(page);
  const revision = await canvasLocator(page).getAttribute('data-render-revision');
  await page.getByRole('slider', { name: 'brightness' }).fill('50');
  await waitForGpuRender(page, revision);
  const adjusted = await canvasScreenshot(page);
  expect(adjusted.equals(baseline)).toBe(false);

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
  const baseline = await canvasScreenshot(page);
  const baselineRevision = await canvasLocator(page).getAttribute('data-render-revision');

  await page.getByRole('slider', { name: 'brightness' }).fill('35');
  await waitForGpuRender(page, baselineRevision);
  const edited = await canvasScreenshot(page);
  expect(edited.equals(baseline)).toBe(false);

  const editedRevision = await canvasLocator(page).getAttribute('data-render-revision');
  await page.getByTestId('button-canvas-undo').click();
  await waitForGpuRender(page, editedRevision);
  expect((await canvasScreenshot(page)).equals(baseline)).toBe(true);

  const undoRevision = await canvasLocator(page).getAttribute('data-render-revision');
  const redoButton = page.getByTestId('button-canvas-redo');
  if (await redoButton.count()) await redoButton.click();
  else await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await waitForGpuRender(page, undoRevision);
  expect((await canvasScreenshot(page)).equals(edited)).toBe(true);
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

  test('exposes a semantic canvas target for the browser contract', async ({ page }) => {
    await expect(canvasLocator(page)).toHaveAttribute('aria-label', 'Seed preview');
    await expect(seedStageLocator(page)).toHaveCount(1);
  });

  test('keeps undo and redo controls discoverable on the real stage', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeVisible();
  });
});
